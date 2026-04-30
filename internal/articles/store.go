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
	defaultMarkdown   = "# 春日读书笔记\n\n" +
		"午后重读《长安的荔枝》，最打动我的还是那些看似细碎的执行细节。\n\n" +
		"> 真正困难的不是想法，而是把每一步都落到可验证的现实里。\n\n" +
		"## 摘录\n\n" +
		"- 时间会放大流程里的缝隙\n" +
		"- 好方案通常先解决最确定的问题\n" +
		"- 复杂系统需要留下回退空间\n\n" +
		"```ts\n" +
		"const note = '先把路走通，再谈优雅'\n" +
		"```\n"
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
	root string
}

type resolvedDirectory struct {
	fullPath     string
	relativePath string
	depth        int
}

type resolvedArticle struct {
	fullPath     string
	relativePath string
}

func New(root string) (*Store, error) {
	absoluteRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}

	return &Store{root: filepath.Clean(absoluteRoot)}, nil
}

func (store *Store) Root() string {
	return store.root
}

func (store *Store) EnsureDefaultLibrary() error {
	defaultDirectory := filepath.Join(store.root, "默认目录")
	defaultArticle := filepath.Join(defaultDirectory, "春日读书笔记.md")

	if err := os.MkdirAll(defaultDirectory, 0o755); err != nil {
		return err
	}

	file, err := os.OpenFile(defaultArticle, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if errors.Is(err, fs.ErrExist) {
		return nil
	}

	if err != nil {
		return err
	}

	defer file.Close()
	_, err = file.WriteString(defaultMarkdown)

	return err
}

func (store *Store) GetArticleTree() (any, error) {
	if err := os.MkdirAll(store.root, 0o755); err != nil {
		return nil, err
	}

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

	if err := assertDirectoryExists(parent.fullPath); err != nil {
		return nil, err
	}

	name, err := validateName(rawName, "目录名")
	if err != nil {
		return nil, err
	}

	fullPath := filepath.Join(parent.fullPath, name)
	if err := store.assertInsideRoot(fullPath); err != nil {
		return nil, err
	}

	if err := os.Mkdir(fullPath, 0o755); err != nil {
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

	if err := assertDirectoryExists(directory.fullPath); err != nil {
		return nil, err
	}

	fileName, err := normalizeArticleFileName(rawName)
	if err != nil {
		return nil, err
	}

	fullPath := filepath.Join(directory.fullPath, fileName)
	if err := store.assertInsideRoot(fullPath); err != nil {
		return nil, err
	}

	file, err := os.OpenFile(fullPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
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

	fileStat, err := os.Stat(fullPath)
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

	if err := assertDirectoryExists(directory.fullPath); err != nil {
		return nil, err
	}

	name, err := validateName(rawName, "目录名")
	if err != nil {
		return nil, err
	}

	parentPath := filepath.Dir(directory.fullPath)
	targetPath := filepath.Join(parentPath, name)
	if err := store.assertInsideRoot(targetPath); err != nil {
		return nil, err
	}

	if filepath.Clean(targetPath) == filepath.Clean(directory.fullPath) {
		return map[string]any{
			"oldPath": directory.relativePath,
			"path":    directory.relativePath,
			"name":    name,
		}, nil
	}

	if err := assertPathAvailable(targetPath, "同名目录已存在"); err != nil {
		return nil, err
	}

	if err := os.Rename(directory.fullPath, targetPath); err != nil {
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

	if err := assertFileExists(article.fullPath); err != nil {
		return nil, err
	}

	fileName, err := normalizeArticleFileName(rawName)
	if err != nil {
		return nil, err
	}

	targetPath := filepath.Join(filepath.Dir(article.fullPath), fileName)
	if err := store.assertInsideRoot(targetPath); err != nil {
		return nil, err
	}

	if filepath.Clean(targetPath) == filepath.Clean(article.fullPath) {
		fileStat, err := os.Stat(article.fullPath)
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

	if err := assertPathAvailable(targetPath, "同名文章已存在"); err != nil {
		return nil, err
	}

	if err := os.Rename(article.fullPath, targetPath); err != nil {
		return nil, err
	}

	fileStat, err := os.Stat(targetPath)
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

	if err := assertDirectoryExists(directory.fullPath); err != nil {
		return nil, err
	}

	if err := assertDirectoryCanBeDeleted(directory.fullPath); err != nil {
		return nil, err
	}

	if err := removeEmptyDirectoryTree(directory.fullPath); err != nil {
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

	if err := assertFileExists(article.fullPath); err != nil {
		return nil, err
	}

	if err := os.Remove(article.fullPath); err != nil {
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

	if err := assertFileExists(article.fullPath); err != nil {
		return "", err
	}

	content, err := os.ReadFile(article.fullPath)
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

	if err := assertFileExists(article.fullPath); err != nil {
		return nil, err
	}

	if err := os.WriteFile(article.fullPath, []byte(content), 0o644); err != nil {
		return nil, err
	}

	fileStat, err := os.Stat(article.fullPath)
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

	entries, err := os.ReadDir(directory.fullPath)
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

	fullPath := filepath.Join(append([]string{store.root}, segments...)...)
	if err := store.assertInsideRoot(fullPath); err != nil {
		return resolvedDirectory{}, err
	}

	return resolvedDirectory{
		fullPath:     fullPath,
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

	fullPath := filepath.Join(append([]string{store.root}, segments...)...)
	if err := store.assertInsideRoot(fullPath); err != nil {
		return resolvedArticle{}, err
	}

	return resolvedArticle{
		fullPath:     fullPath,
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
	if strings.HasSuffix(baseName, articleExtension) {
		baseName = strings.TrimSpace(strings.TrimSuffix(baseName, articleExtension))
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

func assertDirectoryExists(fullPath string) error {
	fileStat, err := os.Stat(fullPath)
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

func assertFileExists(fullPath string) error {
	fileStat, err := os.Stat(fullPath)
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

func assertPathAvailable(fullPath string, message string) error {
	_, err := os.Stat(fullPath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}

	if err != nil {
		return err
	}

	return &storeError{statusCode: http.StatusConflict, message: message}
}

func assertDirectoryCanBeDeleted(fullPath string) error {
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		childPath := filepath.Join(fullPath, entry.Name())

		if entry.IsDir() {
			if err := assertDirectoryCanBeDeleted(childPath); err != nil {
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

func removeEmptyDirectoryTree(fullPath string) error {
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		childPath := filepath.Join(fullPath, entry.Name())

		if entry.IsDir() {
			if err := removeEmptyDirectoryTree(childPath); err != nil {
				return err
			}
			continue
		}

		if entry.Type().IsRegular() && strings.HasSuffix(entry.Name(), articleExtension) {
			return &storeError{statusCode: http.StatusConflict, message: "目录下还有文章"}
		}

		return &storeError{statusCode: http.StatusConflict, message: "目录下还有非文章文件"}
	}

	if err := os.Remove(fullPath); err != nil {
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

func (store *Store) assertInsideRoot(fullPath string) error {
	relativePath, err := filepath.Rel(store.root, filepath.Clean(fullPath))
	if err != nil {
		return &storeError{statusCode: http.StatusBadRequest, message: "路径不能超出文章库"}
	}

	if relativePath == ".." || strings.HasPrefix(relativePath, ".."+string(filepath.Separator)) || filepath.IsAbs(relativePath) {
		return &storeError{statusCode: http.StatusBadRequest, message: "路径不能超出文章库"}
	}

	return nil
}

func formatModifiedTime(modifiedTime time.Time) string {
	return modifiedTime.UTC().Format("2006-01-02T15:04:05.000Z")
}
