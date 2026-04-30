//go:build release

package web

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

//go:embed dist
var embeddedDist embed.FS

func NewHandler() http.Handler {
	dist, err := fs.Sub(embeddedDist, "dist")
	if err != nil {
		panic(err)
	}

	fileServer := http.FileServer(http.FS(dist))

	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		cleanPath := strings.TrimPrefix(path.Clean(request.URL.Path), "/")
		if cleanPath == "." || cleanPath == "" {
			serveEmbeddedIndex(response, request, dist)
			return
		}

		if fileExists(dist, cleanPath) {
			fileServer.ServeHTTP(response, request)
			return
		}

		if path.Ext(cleanPath) != "" || strings.HasPrefix(cleanPath, "assets/") {
			http.NotFound(response, request)
			return
		}

		serveEmbeddedIndex(response, request, dist)
	})
}

func serveEmbeddedIndex(response http.ResponseWriter, request *http.Request, dist fs.FS) {
	request = request.Clone(request.Context())
	request.URL.Path = "/index.html"
	http.FileServer(http.FS(dist)).ServeHTTP(response, request)
}

func fileExists(dist fs.FS, name string) bool {
	fileInfo, err := fs.Stat(dist, name)
	return err == nil && !fileInfo.IsDir()
}
