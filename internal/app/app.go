package app

import (
	"errors"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"time"

	"md2wechat/internal/articles"
	"md2wechat/internal/server"
	"md2wechat/web"
)

type serverConfig struct {
	host        string
	port        int
	articleRoot string
	noOpen      bool
}

func Run() error {
	config, err := parseConfig()
	if err != nil {
		return err
	}

	store, err := articles.New(config.articleRoot)
	if err != nil {
		return err
	}

	if err := store.EnsureDefaultLibrary(); err != nil {
		return err
	}

	listener, actualPort, err := listen(config.host, config.port)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("http://%s:%d", browserHost(config.host), actualPort)
	httpServer := &http.Server{
		Handler:      server.New(store, web.NewHandler()),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	log.Printf("md2wechat listening on %s", url)
	log.Printf("article root: %s", store.Root())

	if !config.noOpen {
		go func() {
			time.Sleep(300 * time.Millisecond)
			if err := openBrowser(url); err != nil {
				log.Printf("浏览器打开失败，请手动访问 %s：%v", url, err)
			}
		}()
	}

	err = httpServer.Serve(listener)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}

	return err
}

func parseConfig() (serverConfig, error) {
	var config serverConfig

	flag.StringVar(&config.host, "host", "127.0.0.1", "server host")
	flag.IntVar(&config.port, "port", 4174, "server port")
	flag.StringVar(&config.articleRoot, "article-root", "", "article library root")
	flag.BoolVar(&config.noOpen, "no-open", false, "do not open browser")
	flag.Parse()

	articleRoot, err := resolveArticleRoot(config.articleRoot)
	if err != nil {
		return config, err
	}

	config.articleRoot = articleRoot
	return config, nil
}

func resolveArticleRoot(flagValue string) (string, error) {
	if flagValue != "" {
		return filepath.Abs(flagValue)
	}

	if envValue := os.Getenv("MD2WECHAT_ARTICLE_ROOT"); envValue != "" {
		return filepath.Abs(envValue)
	}

	return defaultArticleRoot()
}

func defaultArticleRoot() (string, error) {
	switch runtime.GOOS {
	case "windows":
		if appData := os.Getenv("APPDATA"); appData != "" {
			return filepath.Join(appData, "md2wechat", "articles"), nil
		}
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}

		return filepath.Join(home, "Library", "Application Support", "md2wechat", "articles"), nil
	default:
		if xdgDataHome := os.Getenv("XDG_DATA_HOME"); xdgDataHome != "" {
			return filepath.Join(xdgDataHome, "md2wechat", "articles"), nil
		}

		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}

		return filepath.Join(home, ".local", "share", "md2wechat", "articles"), nil
	}

	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(configDir, "md2wechat", "articles"), nil
}

func listen(host string, port int) (net.Listener, int, error) {
	if port < 0 || port > 65535 {
		return nil, 0, fmt.Errorf("端口不合法：%d", port)
	}

	listener, err := net.Listen("tcp", net.JoinHostPort(host, strconv.Itoa(port)))
	if err == nil {
		return listener, listenerPort(listener), nil
	}

	if port == 0 {
		return nil, 0, err
	}

	fallbackListener, fallbackErr := net.Listen("tcp", net.JoinHostPort(host, "0"))
	if fallbackErr != nil {
		return nil, 0, err
	}

	fallbackPort := listenerPort(fallbackListener)
	log.Printf("端口 %d 不可用，已切换到 %d", port, fallbackPort)

	return fallbackListener, fallbackPort, nil
}

func listenerPort(listener net.Listener) int {
	tcpAddr, ok := listener.Addr().(*net.TCPAddr)
	if !ok {
		return 0
	}

	return tcpAddr.Port
}

func browserHost(host string) string {
	if host == "" || host == "0.0.0.0" || host == "::" {
		return "127.0.0.1"
	}

	return host
}

func openBrowser(url string) error {
	var command *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		command = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		command = exec.Command("open", url)
	default:
		command = exec.Command("xdg-open", url)
	}

	return command.Start()
}
