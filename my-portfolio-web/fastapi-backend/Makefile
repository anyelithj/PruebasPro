# [DRY] comandos comunes centralizados
.PHONY: help install dev up down migrate revision test lint fmt proto

help:
	@echo "install   - poetry install"
	@echo "dev       - run API with reload (needs infra up)"
	@echo "infra     - start postgres+redis (dev compose)"
	@echo "up/down   - full docker stack"
	@echo "migrate   - alembic upgrade head"
	@echo "revision  - alembic autogenerate (m='msg')"
	@echo "test      - pytest"
	@echo "lint/fmt  - ruff / black"
	@echo "proto     - genera stubs gRPC desde /proto"

proto:
	python -m grpc_tools.protoc -I proto \
		--python_out=src/infrastructure/grpc/generated \
		--grpc_python_out=src/infrastructure/grpc/generated \
		proto/*.proto

install:
	poetry install

infra:
	docker compose -f docker-compose.dev.yml up -d

dev:
	uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

up:
	docker compose up --build

down:
	docker compose down

migrate:
	alembic upgrade head

revision:
	alembic revision --autogenerate -m "$(m)"

test:
	pytest -q

lint:
	ruff check src tests

fmt:
	black src tests && ruff check --fix src tests
