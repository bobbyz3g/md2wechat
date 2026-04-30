package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"md2wechat/internal/articles"
)

const maxJSONBodySize = 10 * 1024 * 1024

type ArticleStore interface {
	Root() string
	GetArticleTree() (any, error)
	CreateDirectory(parentPath string, rawName any) (any, error)
	CreateArticle(directoryPath string, rawName any, content string) (any, error)
	RenameDirectory(directoryPath string, rawName any) (any, error)
	RenameArticle(articlePath string, rawName any) (any, error)
	DeleteDirectory(directoryPath string) (any, error)
	DeleteArticle(articlePath string) (any, error)
	ReadArticle(articlePath string) (string, error)
	SaveArticle(articlePath string, rawContent any) (any, error)
}

type apiError struct {
	statusCode int
	message    string
}

func (err *apiError) Error() string {
	return err.message
}

type application struct {
	store ArticleStore
	web   http.Handler
}

func New(store ArticleStore, web http.Handler) http.Handler {
	return (&application{
		store: store,
		web:   web,
	}).handler()
}

func (app *application) handler() http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Method == http.MethodOptions {
			response.WriteHeader(http.StatusNoContent)
			return
		}

		if request.URL.Path == "/api" || strings.HasPrefix(request.URL.Path, "/api/") {
			app.handleAPI(response, request)
			return
		}

		app.web.ServeHTTP(response, request)
	})
}

func (app *application) handleAPI(response http.ResponseWriter, request *http.Request) {
	var (
		payload any
		status  = http.StatusOK
		err     error
	)

	switch {
	case request.Method == http.MethodGet && request.URL.Path == "/api/health":
		payload = map[string]any{
			"ok":          true,
			"articleRoot": app.store.Root(),
		}
	case request.Method == http.MethodGet && request.URL.Path == "/api/articles/tree":
		payload, err = app.store.GetArticleTree()
	case request.Method == http.MethodPost && request.URL.Path == "/api/articles/directories":
		status = http.StatusCreated
		payload, err = app.createDirectory(request)
	case request.Method == http.MethodPost && request.URL.Path == "/api/articles":
		status = http.StatusCreated
		payload, err = app.createArticle(request)
	case request.Method == http.MethodPatch && request.URL.Path == "/api/articles/directories":
		payload, err = app.renameDirectory(request)
	case request.Method == http.MethodPatch && request.URL.Path == "/api/articles":
		payload, err = app.renameArticle(request)
	case request.Method == http.MethodDelete && request.URL.Path == "/api/articles/directories":
		payload, err = app.store.DeleteDirectory(request.URL.Query().Get("path"))
	case request.Method == http.MethodDelete && request.URL.Path == "/api/articles":
		payload, err = app.store.DeleteArticle(request.URL.Query().Get("path"))
	case request.Method == http.MethodGet && request.URL.Path == "/api/articles/content":
		articlePath := request.URL.Query().Get("path")
		content, readErr := app.store.ReadArticle(articlePath)
		err = readErr
		payload = map[string]any{
			"path":    articlePath,
			"content": content,
		}
	case request.Method == http.MethodPut && request.URL.Path == "/api/articles/content":
		payload, err = app.saveArticle(request)
	default:
		sendJSON(response, http.StatusNotFound, map[string]any{
			"message": "接口不存在",
		})
		return
	}

	if err != nil {
		handleAPIError(response, err)
		return
	}

	sendJSON(response, status, payload)
}

func (app *application) createDirectory(request *http.Request) (any, error) {
	body, err := readJSONBody(request)
	if err != nil {
		return nil, err
	}

	parentPath, err := optionalStringField(body, "parentPath", "目录路径")
	if err != nil {
		return nil, err
	}

	return app.store.CreateDirectory(parentPath, body["name"])
}

func (app *application) createArticle(request *http.Request) (any, error) {
	body, err := readJSONBody(request)
	if err != nil {
		return nil, err
	}

	directoryPath, err := optionalStringField(body, "directoryPath", "目录路径")
	if err != nil {
		return nil, err
	}

	content, ok := body["content"].(string)
	if !ok {
		content = fmt.Sprintf("# %v\n\n", body["name"])
	}

	return app.store.CreateArticle(directoryPath, body["name"], content)
}

func (app *application) renameDirectory(request *http.Request) (any, error) {
	body, err := readJSONBody(request)
	if err != nil {
		return nil, err
	}

	directoryPath, err := optionalStringField(body, "path", "目录路径")
	if err != nil {
		return nil, err
	}

	return app.store.RenameDirectory(directoryPath, body["name"])
}

func (app *application) renameArticle(request *http.Request) (any, error) {
	body, err := readJSONBody(request)
	if err != nil {
		return nil, err
	}

	articlePath, err := optionalStringField(body, "path", "文章路径")
	if err != nil {
		return nil, err
	}

	return app.store.RenameArticle(articlePath, body["name"])
}

func (app *application) saveArticle(request *http.Request) (any, error) {
	body, err := readJSONBody(request)
	if err != nil {
		return nil, err
	}

	articlePath, err := optionalStringField(body, "path", "文章路径")
	if err != nil {
		return nil, err
	}

	return app.store.SaveArticle(articlePath, body["content"])
}

func readJSONBody(request *http.Request) (map[string]any, error) {
	body, err := io.ReadAll(io.LimitReader(request.Body, maxJSONBodySize+1))
	if err != nil {
		return nil, err
	}

	if len(body) > maxJSONBodySize {
		return nil, &apiError{statusCode: http.StatusRequestEntityTooLarge, message: "请求内容过大"}
	}

	if strings.TrimSpace(string(body)) == "" {
		return map[string]any{}, nil
	}

	var value any
	if err := json.Unmarshal(body, &value); err != nil {
		return nil, &apiError{statusCode: http.StatusBadRequest, message: "请求 JSON 格式不合法"}
	}

	objectValue, ok := value.(map[string]any)
	if !ok {
		return map[string]any{}, nil
	}

	return objectValue, nil
}

func optionalStringField(body map[string]any, key string, fieldName string) (string, error) {
	value, ok := body[key]
	if !ok || value == nil {
		return "", nil
	}

	text, ok := value.(string)
	if !ok {
		return "", &apiError{statusCode: http.StatusBadRequest, message: fieldName + "必须是字符串"}
	}

	return text, nil
}

func sendJSON(response http.ResponseWriter, statusCode int, payload any) {
	response.Header().Set("Content-Type", "application/json; charset=utf-8")
	response.WriteHeader(statusCode)
	_ = json.NewEncoder(response).Encode(payload)
}

func handleAPIError(response http.ResponseWriter, err error) {
	var requestError *apiError
	if errors.As(err, &requestError) {
		sendJSON(response, requestError.statusCode, map[string]any{
			"message": requestError.message,
		})
		return
	}

	if statusCode, message, ok := articles.ErrorResponse(err); ok {
		sendJSON(response, statusCode, map[string]any{
			"message": message,
		})
		return
	}

	log.Print(err)
	sendJSON(response, http.StatusInternalServerError, map[string]any{
		"message": "服务端处理失败",
	})
}
