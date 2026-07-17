.PHONY: help dev build release test lint

help:
	@echo "可用命令："
	@echo "  make dev              启动 Electron 桌面应用开发环境"
	@echo "  make build            打包当前平台的 Electron 桌面应用"
	@echo "  make release          生成当前平台的 Electron 安装包"
	@echo "  make test             运行现有前端测试"
	@echo "  make lint             运行 TypeScript 类型检查和前端 lint"

dev:
	npm run start

build:
	npm run package

release:
	npm run make

test:
	npm test

lint:
	npm run typecheck
	npm run lint
