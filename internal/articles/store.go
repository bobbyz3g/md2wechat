package articles

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"time"
	"unicode/utf8"
)

const (
	maxDirectoryDepth = 2
	articleExtension  = ".md"
)

type storeError struct {
	statusCode int
	message    string
}

func (err *storeError) Error() string {
	return err.message
}

func ErrorResponse(err error) (int, string, bool) {
	var articleError *storeError
	if errors.As(err, &articleError) {
		return articleError.statusCode, articleError.message, true
	}

	return 0, "", false
}

type Store struct {
	root       string
	rootHandle *os.Root
}

type resolvedDirectory struct {
	filePath     string
	relativePath string
	depth        int
}

type resolvedArticle struct {
	filePath     string
	relativePath string
}

func New(root string) (*Store, error) {
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}

	cleanRoot := filepath.Clean(absoluteRoot)
	if err := os.MkdirAll(cleanRoot, 0o755); err != nil {
		return nil, err
	}

	rootHandle, err := os.OpenRoot(cleanRoot)
	if err != nil {
		return nil, err
	}

	return &Store{root: cleanRoot, rootHandle: rootHandle}, nil
}

func (store *Store) Root() string {
	return store.root
}

func (store *Store) Close() error {
	return store.rootHandle.Close()
}

func (store *Store) GetArticleTree() (any, error) {
	children, err := store.readDirectory("", 0)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"type":     "root",
		"name":     "文章库",
		"path":     "",
		"children": children,
	}, nil
}

func (store *Store) CreateDirectory(parentPath string, rawName any) (any, error) {
	parent, err := store.resolveDirectoryPath(parentPath)
	if err != nil {
		return nil, err
	}

	if parent.depth >= maxDirectoryDepth {
		return nil, &storeError{statusCode: http.StatusBadRequest, message: "目录最多只能创建两层"}
	}

	if err := store.assertDirectoryExists(parent.filePath); err != nil {
		return nil, err
	}

	name, err := validateName(rawName, "目录名")
	if err != nil {
		return nil, err
	}

	filePath := filepath.Join(parent.filePath, name)
	if err := store.rootHandle.Mkdir(filePath, 0o755); err != nil {
		if errors.Is(err, fs.ErrExist) {
			return nil, &storeError{statusCode: http.StatusConflict, message: "同名目录已存在"}
		}

		return nil, err
	}

	relativePath := joinPath(parent.relativePath, name)

	return map[string]any{
		"type":     "directory",
		"name":     name,
		"path":     relativePath,
		"depth":    parent.depth + 1,
		"children": []any{},
	}, nil
}

func (store *Store) CreateArticle(directoryPath string, rawName any, content string) (any, error) {
	directory, err := store.resolveDirectoryPath(directoryPath)
	if err != nil {
		return nil, err
	}

	if directory.depth < 1 {
		return nil, &storeError{statusCode: http.StatusBadRequest, message: "文章必须创建在目录中"}
	}

	if directory.depth > maxDirectoryDepth {
		return nil, &storeError{statusCode: http.StatusBadRequest, message: "目录层级超过限制"}
	}

	if err := store.assertDirectoryExists(directory.filePath); err != nil {
		return nil, err
	}

	fileName, err := normalizeArticleFileName(rawName)
	if err != nil {
		return nil, err
	}

	filePath := filepath.Join(directory.filePath, fileName)
	file, err := store.rootHandle.OpenFile(filePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if errors.Is(err, fs.ErrExist) {
		return nil, &storeError{statusCode: http.StatusConflict, message: "同名文章已存在"}
	}

	if err != nil {
		return nil, err
	}

	if _, err := file.WriteString(content); err != nil {
		_ = file.Close()
		return nil, err
	}

	if err := file.Close(); err != nil {
		return nil, err
	}

	fileStat, err := store.rootHandle.Stat(filePath)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"type":      "article",
		"name":      getArticleName(fileName),
		"path":      joinPath(directory.relativePath, fileName),
		"updatedAt": formatModifiedTime(fileStat.ModTime()),
	}, nil
}

func (store *Store) RenameDirectory(directoryPath string, rawName any) (any, error) {
	directory, err := store.resolveDirectoryPath(directoryPath)
	if err != nil {
		return nil, err
	}

	if directory.depth < 1 {
		return nil, &storeError{statusCode: http.StatusBadRequest, message: "不能重命名文章库根目录"}
	}

	if directory.depth > maxDirectoryDepth {
		return nil, &storeError{statusCode: http.StatusBadRequest, message: "目录层级超过限制"}
	}

	if err := store.assertDirectoryExists(directory.filePath); err != nil {
		return nil, err
	}

	name, err := validateName(rawName, "目录名")
	if err != nil {
		return nil, err
	}

	parentPath := filepath.Dir(directory.filePath)
	targetPath := filepath.Join(parentPath, name)

	if filepath.Clean(targetPath) == filepath.Clean(directory.filePath) {
		return map[string]any{
			"oldPath": directory.relativePath,
			"path":    directory.relativePath,
			"name":    name,
		}, nil
	}

	if err := store.assertPathAvailable(targetPath, "同名目录已存在"); err != nil {
		return nil, err
	}

	if err := store.rootHandle.Rename(directory.filePath, targetPath); err != nil {
		return nil, err
	}

	parentRelativePath := parentAPIPath(directory.relativePath)

	return map[string]any{
		"oldPath": directory.relativePath,
		"path":    joinPath(parentRelativePath, name),
		"name":    name,
	}, nil
}

func (store *Store) RenameArticle(articlePath string, rawName any) (any, error) {
	article, err := store.resolveArticlePath(articlePath)
	if err != nil {
		return nil, err
	}

	if err := store.assertFileExists(article.filePath); err != nil {
		return nil, err
	}

	fileName, err := normalizeArticleFileName(rawName)
	if err != nil {
		return nil, err
	}

	targetPath := filepath.Join(filepath.Dir(article.filePath), fileName)

	if filepath.Clean(targetPath) == filepath.Clean(article.filePath) {
		fileStat, err := store.rootHandle.Stat(article.filePath)
		if err != nil {
			return nil, err
		}

		return map[string]any{
			"oldPath":   article.relativePath,
			"path":      article.relativePath,
			"name":      getArticleName(fileName),
			"updatedAt": formatModifiedTime(fileStat.ModTime()),
		}, nil
	}

	if err := store.assertPathAvailable(targetPath, "同名文章已存在"); err != nil {
		return nil, err
	}

	if err := store.rootHandle.Rename(article.filePath, targetPath); err != nil {
		return nil, err
	}

	fileStat, err := store.rootHandle.Stat(targetPath)
	if err != nil {
		return nil, err
	}

	parentRelativePath := parentAPIPath(article.relativePath)

	return map[string]any{
		"oldPath":   article.relativePath,
		"path":      joinPath(parentRelativePath, fileName),
		"name":      getArticleName(fileName),
		"updatedAt": formatModifiedTime(fileStat.ModTime()),
	}, nil
}

func (store *Store) DeleteDirectory(directoryPath string) (any, error) {
	directory, err := store.resolveDirectoryPath(directoryPath)
	if err != nil {
		return nil, err
	}

	if directory.depth < 1 {
		return nil, &storeError{statusCode: http.StatusBadRequest, message: "不能删除文章库根目录"}
	}

	if directory.depth > maxDirectoryDepth {
		return nil, &storeError{statusCode: http.StatusBadRequest, message: "目录层级超过限制"}
	}

	if err := store.assertDirectoryExists(directory.filePath); err != nil {
		return nil, err
	}

	if err := store.assertDirectoryCanBeDeleted(directory.filePath); err != nil {
		return nil, err
	}

	if err := store.removeEmptyDirectoryTree(directory.filePath); err != nil {
		return nil, err
	}

	return map[string]any{
		"path": directory.relativePath,
	}, nil
}

func (store *Store) DeleteArticle(articlePath string) (any, error) {
	article, err := store.resolveArticlePath(articlePath)
	if err != nil {
		return nil, err
	}

	if err := store.assertFileExists(article.filePath); err != nil {
		return nil, err
	}

	if err := store.rootHandle.Remove(article.filePath); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, &storeError{statusCode: http.StatusNotFound, message: "文章不存在"}
		}

		return nil, err
	}

	return map[string]any{
		"path": article.relativePath,
	}, nil
}

func (store *Store) ReadArticle(articlePath string) (string, error) {
	article, err := store.resolveArticlePath(articlePath)
	if err != nil {
		return "", err
	}

	if err := store.assertFileExists(article.filePath); err != nil {
		return "", err
	}

	content, err := store.rootHandle.ReadFile(article.filePath)
	if err != nil {
		return "", err
	}

	return string(content), nil
}

func (store *Store) SaveArticle(articlePath string, rawContent any) (any, error) {
	content, ok := rawContent.(string)
	if !ok {
		return nil, &storeError{statusCode: http.StatusBadRequest, message: "文章内容必须是字符串"}
	}

	article, err := store.resolveArticlePath(articlePath)
	if err != nil {
		return nil, err
	}

	if err := store.assertFileExists(article.filePath); err != nil {
		return nil, err
	}

	if err := store.rootHandle.WriteFile(article.filePath, []byte(content), 0o644); err != nil {
		return nil, err
	}

	fileStat, err := store.rootHandle.Stat(article.filePath)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"path":      article.relativePath,
		"updatedAt": formatModifiedTime(fileStat.ModTime()),
	}, nil
}

func (store *Store) readDirectory(relativePath string, depth int) ([]any, error) {
	directory, err := store.resolveDirectoryPath(relativePath)
	if err != nil {
		return nil, err
	}

	entries, err := store.readDir(directory.filePath)
	if err != nil {
		return nil, err
	}

	nodes := make([]any, 0, len(entries))

	for _, entry := range entries {
		childPath := joinPath(relativePath, entry.Name())

		if entry.IsDir() {
			children, err := store.readDirectory(childPath, depth+1)
			if err != nil {
				return nil, err
			}

			nodes = append(nodes, map[string]any{
				"type":     "directory",
				"name":     entry.Name(),
				"path":     childPath,
				"depth":    depth + 1,
				"children": children,
			})
			continue
		}

		if entry.Type().IsRegular() && strings.HasSuffix(entry.Name(), articleExtension) {
			fileStat, err := entry.Info()
			if err != nil {
				return nil, err
			}

			nodes = append(nodes, map[string]any{
				"type":      "article",
				"name":      getArticleName(entry.Name()),
				"path":      childPath,
				"updatedAt": formatModifiedTime(fileStat.ModTime()),
			})
		}
	}

	sort.Slice(nodes, func(leftIndex int, rightIndex int) bool {
		left := nodes[leftIndex].(map[string]any)
		right := nodes[rightIndex].(map[string]any)
		leftType := left["type"].(string)
		rightType := right["type"].(string)

		if leftType != rightType {
			return leftType == "directory"
		}

		return left["name"].(string) < right["name"].(string)
	})

	return nodes, nil
}

func (store *Store) resolveDirectoryPath(relativePath string) (resolvedDirectory, error) {
	segments, err := getSafeSegments(relativePath, "目录路径")
	if err != nil {
		return resolvedDirectory{}, err
	}

	return resolvedDirectory{
		filePath:     filePathFromSegments(segments),
		relativePath: strings.Join(segments, "/"),
		depth:        len(segments),
	}, nil
}

func (store *Store) resolveArticlePath(relativePath string) (resolvedArticle, error) {
	segments, err := getSafeSegments(relativePath, "文章路径")
	if err != nil {
		return resolvedArticle{}, err
	}

	if len(segments) == 0 || !strings.HasSuffix(segments[len(segments)-1], articleExtension) {
		return resolvedArticle{}, &storeError{statusCode: http.StatusBadRequest, message: "文章路径必须指向 .md 文件"}
	}

	if len(segments) < 2 {
		return resolvedArticle{}, &storeError{statusCode: http.StatusBadRequest, message: "文章必须位于目录中"}
	}

	directoryDepth := len(segments) - 1
	if directoryDepth > maxDirectoryDepth {
		return resolvedArticle{}, &storeError{statusCode: http.StatusBadRequest, message: "目录层级超过限制"}
	}

	return resolvedArticle{
		filePath:     filePathFromSegments(segments),
		relativePath: strings.Join(segments, "/"),
	}, nil
}

func getSafeSegments(relativePath string, fieldName string) ([]string, error) {
	if relativePath == "" {
		return []string{}, nil
	}

	if strings.Contains(relativePath, "\\") ||
		strings.HasPrefix(relativePath, "/") ||
		filepath.IsAbs(relativePath) ||
		strings.Contains(relativePath, "\x00") {
		return nil, &storeError{statusCode: http.StatusBadRequest, message: fieldName + "不合法"}
	}

	segments := strings.Split(relativePath, "/")
	for _, segment := range segments {
		if err := validatePathSegment(segment, fieldName); err != nil {
			return nil, err
		}
	}

	return segments, nil
}

func validatePathSegment(segment string, fieldName string) error {
	if segment == "" || segment == "." || segment == ".." {
		return &storeError{statusCode: http.StatusBadRequest, message: fieldName + "不合法"}
	}

	return nil
}

func validateName(rawName any, fieldName string) (string, error) {
	name, ok := rawName.(string)
	if !ok {
		return "", &storeError{statusCode: http.StatusBadRequest, message: fieldName + "必须是字符串"}
	}

	name = strings.TrimSpace(name)

	if name == "" {
		return "", &storeError{statusCode: http.StatusBadRequest, message: fieldName + "不能为空"}
	}

	if name == "." ||
		name == ".." ||
		strings.Contains(name, "/") ||
		strings.Contains(name, "\\") ||
		strings.Contains(name, "\x00") ||
		strings.ContainsAny(name, "\r\n") {
		return "", &storeError{statusCode: http.StatusBadRequest, message: fieldName + "不合法"}
	}

	if utf8.RuneCountInString(name) > 80 {
		return "", &storeError{statusCode: http.StatusBadRequest, message: fieldName + "不能超过 80 个字符"}
	}

	return name, nil
}

func normalizeArticleFileName(rawName any) (string, error) {
	name, err := validateName(rawName, "文章名")
	if err != nil {
		return "", err
	}

	baseName := name
	if before, ok := strings.CutSuffix(baseName, articleExtension); ok {
		baseName = strings.TrimSpace(before)
	}

	baseName, err = validateName(baseName, "文章名")
	if err != nil {
		return "", err
	}

	return baseName + articleExtension, nil
}

func getArticleName(fileName string) string {
	return strings.TrimSuffix(fileName, articleExtension)
}

func joinPath(parentPath string, childName string) string {
	if parentPath == "" {
		return childName
	}

	return parentPath + "/" + childName
}

func parentAPIPath(relativePath string) string {
	segments := strings.Split(relativePath, "/")
	if len(segments) <= 1 {
		return ""
	}

	return strings.Join(segments[:len(segments)-1], "/")
}

func filePathFromSegments(segments []string) string {
	if len(segments) == 0 {
		return "."
	}

	return filepath.Join(segments...)
}

func (store *Store) assertDirectoryExists(filePath string) error {
	fileStat, err := store.rootHandle.Stat(filePath)
	if errors.Is(err, fs.ErrNotExist) {
		return &storeError{statusCode: http.StatusNotFound, message: "目录不存在"}
	}

	if err != nil {
		return err
	}

	if !fileStat.IsDir() {
		return &storeError{statusCode: http.StatusBadRequest, message: "目标路径不是目录"}
	}

	return nil
}

func (store *Store) assertFileExists(filePath string) error {
	fileStat, err := store.rootHandle.Stat(filePath)
	if errors.Is(err, fs.ErrNotExist) {
		return &storeError{statusCode: http.StatusNotFound, message: "文章不存在"}
	}

	if err != nil {
		return err
	}

	if !fileStat.Mode().IsRegular() {
		return &storeError{statusCode: http.StatusBadRequest, message: "目标路径不是文章文件"}
	}

	return nil
}

func (store *Store) assertPathAvailable(filePath string, message string) error {
	_, err := store.rootHandle.Stat(filePath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}

	if err != nil {
		return err
	}

	return &storeError{statusCode: http.StatusConflict, message: message}
}

func (store *Store) readDir(filePath string) ([]os.DirEntry, error) {
	directory, err := store.rootHandle.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer directory.Close()

	return directory.ReadDir(-1)
}

func (store *Store) assertDirectoryCanBeDeleted(filePath string) error {
	entries, err := store.readDir(filePath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		childPath := filepath.Join(filePath, entry.Name())

		if entry.IsDir() {
			if err := store.assertDirectoryCanBeDeleted(childPath); err != nil {
				return err
			}
			continue
		}

		if entry.Type().IsRegular() && strings.HasSuffix(entry.Name(), articleExtension) {
			return &storeError{statusCode: http.StatusConflict, message: "目录下还有文章"}
		}

		return &storeError{statusCode: http.StatusConflict, message: "目录下还有非文章文件"}
	}

	return nil
}

func (store *Store) removeEmptyDirectoryTree(filePath string) error {
	entries, err := store.readDir(filePath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		childPath := filepath.Join(filePath, entry.Name())

		if entry.IsDir() {
			if err := store.removeEmptyDirectoryTree(childPath); err != nil {
				return err
			}
			continue
		}

		if entry.Type().IsRegular() && strings.HasSuffix(entry.Name(), articleExtension) {
			return &storeError{statusCode: http.StatusConflict, message: "目录下还有文章"}
		}

		return &storeError{statusCode: http.StatusConflict, message: "目录下还有非文章文件"}
	}

	if err := store.rootHandle.Remove(filePath); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return &storeError{statusCode: http.StatusNotFound, message: "目录不存在"}
		}

		if errors.Is(err, syscall.ENOTEMPTY) || errors.Is(err, syscall.EEXIST) {
			return &storeError{statusCode: http.StatusConflict, message: "目录下还有内容"}
		}

		return err
	}

	return nil
}

func formatModifiedTime(modifiedTime time.Time) string {
	return modifiedTime.UTC().Format("2006-01-02T15:04:05.000Z")
}
