.PHONY: help dev dev-api dev-web build build-web build-server install release test test-go test-web lint lint-go lint-web

GO_PACKAGES := ./cmd/md2wechat ./internal/... ./web ./tools/release

help:
	@echo "可用命令："
	@echo "  make dev              启动 Electron 桌面应用开发环境"
	@echo "  make dev-api          只启动 Go API 服务"
	@echo "  make dev-web          只启动 Vite 前端开发服务"
	@echo "  make build            打包当前平台的 Electron 桌面应用"
	@echo "  make build-web        只构建前端资源"
	@echo "  make build-server     只编译内嵌前端资源的 Go 二进制"
	@echo "  make install          构建前端资源并安装本地 Go 命令"
	@echo "  make release          生成当前平台的 Electron 安装包"
	@echo "  make test             运行现有前端测试"
	@echo "  make test-go          只运行 Go 测试"
	@echo "  make test-web         只运行前端测试"
	@echo "  make lint             运行 TypeScript 类型检查和前端 lint"
	@echo "  make lint-go          只运行 Go vet"
	@echo "  make lint-web         只运行前端 lint"

dev:
	npm run start

dev-api:
	go run ./cmd/md2wechat --no-open

dev-web:
	npm --prefix web run dev

build:
	npm run package

build-web:
	npm --prefix web run build

build-server:
	go build -tags release -o release/md2wechat ./cmd/md2wechat

install: build-web
	go install -tags release ./cmd/md2wechat

release:
	npm run make

test:
	npm test

test-go:
	go test $(GO_PACKAGES)

test-web:
	npm --prefix web run test

lint:
	npm run typecheck
	npm run lint

lint-go:
	go vet $(GO_PACKAGES)

lint-web:
	npm --prefix web run lint
