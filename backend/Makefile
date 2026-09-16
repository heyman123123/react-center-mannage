.PHONY: help up down tidy build run restart stop status logs

help:
	@echo "NovasPay Admin API"
	@echo "  make up       启动 Postgres(5433) + Redis(6380)"
	@echo "  make down     停止依赖容器"
	@echo "  make tidy     go mod tidy"
	@echo "  make build    编译到 bin/api"
	@echo "  make run      编译并前台启动 API（:8080）"
	@echo "  make restart  等价 make run"
	@echo "  make stop     结束占用 :8080 的进程"
	@echo "  make status   健康检查"
	@echo "  make logs     docker compose 日志"

up:
	docker compose up -d
	@echo "等待 Postgres/Redis..."
	@sleep 2
	@docker compose ps

down:
	docker compose down

tidy:
	go mod tidy

build:
	@mkdir -p bin
	go build -o bin/api ./cmd/api

run: up build
	./bin/api

restart: run

stop:
	@pids=$$(lsof -t -iTCP:8080 -sTCP:LISTEN 2>/dev/null); \
	if [ -n "$$pids" ]; then kill $$pids && echo "stopped: $$pids"; else echo "nothing on :8080"; fi

status:
	@curl -sf http://127.0.0.1:8080/healthz && echo || echo "API down"
	@curl -sf http://127.0.0.1:8080/readyz && echo || echo "readyz failed"

logs:
	docker compose logs -f --tail=100
