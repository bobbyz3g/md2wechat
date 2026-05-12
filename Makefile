.PHONY: help dev dev-api dev-web build build-web build-server install release test test-go test-web lint lint-go lint-web

GO_PACKAGES := ./cmd/md2wechat ./internal/... ./web ./tools/release

help:
	@echo "可用命令："
	@echo "  make dev              同时启动 Go API 服务和 Vite 前端开发服务"
	@echo "  make dev-api          只启动 Go API 服务"
	@echo "  make dev-web          只启动 Vite 前端开发服务"
	@echo "  make build            构建前端资源并编译本地应用二进制"
	@echo "  make build-web        只构建前端资源"
	@echo "  make build-server     只编译内嵌前端资源的 Go 二进制"
	@echo "  make install          构建前端资源并安装本地 Go 命令"
	@echo "  make release          构建 Linux/Windows/macOS 的 x86 和 ARM 分发包"
	@echo "  make test             运行 Go 和前端测试"
	@echo "  make test-go          只运行 Go 测试"
	@echo "  make test-web         只运行前端测试"
	@echo "  make lint             运行 Go vet 和前端 lint"
	@echo "  make lint-go          只运行 Go vet"
	@echo "  make lint-web         只运行前端 lint"

dev:
	node scripts/dev.mjs

dev-api:
	go run ./cmd/md2wechat --no-open

dev-web:
	npm --prefix web run dev

build: build-web build-server

build-web:
	npm --prefix web run build

build-server:
	go build -tags release -o release/md2wechat ./cmd/md2wechat

install: build-web
	go install -tags release ./cmd/md2wechat

release:
	go run ./tools/release

test: test-go test-web

test-go:
	go test $(GO_PACKAGES)

test-web:
	npm --prefix web run test

lint: lint-go lint-web

lint-go:
	go vet $(GO_PACKAGES)

lint-web:
	npm --prefix web run lint
