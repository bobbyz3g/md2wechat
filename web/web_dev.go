//go:build !release

package web

import (
	"net/http"
)

func NewHandler() http.Handler {
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/" {
			http.NotFound(response, request)
			return
		}

		response.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = response.Write([]byte("<!doctype html><meta charset=\"utf-8\"><title>md2wechat</title><p>前端资源未内嵌。开发时请使用 npm run dev，发布前请先构建前端资源。</p>"))
	})
}
