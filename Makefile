# ============================================================
# Hero To Slay Simulator - Make targets
# ============================================================

COMPOSE_FILE ?= HtS_Docker/docker-compose.yml
DC ?= docker compose -f $(COMPOSE_FILE)
APP_SERVICE := simulator
TEST_SERVICE := test
NODE_IMAGE ?= node:20-alpine
PROJECT_DIR := $(CURDIR)

.PHONY: help setup index \
	start stop restart rebuild logs clean \
	app-start app-stop app-restart app-logs app-status app-clean \
	test-start test-stop test-restart test-logs test-status test-clean \
	test test-unit test-integration test-coverage

help:
	@echo "Hero To Slay Simulator - Available targets"
	@echo ""
	@echo "Setup:"
	@echo "  make setup             Build Docker images from HtS_Docker/docker-compose.yml"
	@echo "  make index             Generate Srcs/cards.json via temporary Node container"
	@echo ""
	@echo "Project lifecycle:"
	@echo "  make start             Start app container"
	@echo "  make stop              Stop app container"
	@echo "  make restart           Restart app container"
	@echo "  make rebuild           Stop app (if running), clean, rebuild, and restart"
	@echo "  make logs              Follow app logs"
	@echo "  make clean             Stop and remove all containers"
	@echo ""
	@echo "Test lifecycle:"
	@echo "  make test-start        Start test service container"
	@echo "  make test-stop         Stop test service container"
	@echo "  make test-restart      Restart test service container"
	@echo "  make test-logs         Follow test service logs"
	@echo "  make test-clean        Remove test service container"
	@echo ""
	@echo "Test execution:"
	@echo "  make test              Run full Jest suite in Docker"
	@echo "  make test-unit         Run unit tests in Docker"
	@echo "  make test-integration  Run integration tests in Docker"
	@echo "  make test-coverage     Run tests with coverage in Docker"

setup:
	$(DC) build $(APP_SERVICE)
	$(DC) --profile test build $(TEST_SERVICE)

index:
	docker run --rm \
		-v "$(PROJECT_DIR):/workspace" \
		-w /workspace/Srcs \
		$(NODE_IMAGE) node indexer.js

start: app-start

stop: app-stop

restart: app-restart

rebuild: stop clean setup start

logs: app-logs

app-start:
	$(DC) up -d $(APP_SERVICE)

app-stop:
	$(DC) stop $(APP_SERVICE) || true

app-restart: app-stop app-start

app-logs:
	$(DC) logs -f $(APP_SERVICE)

app-status:
	$(DC) ps $(APP_SERVICE)

app-clean:
	$(DC) rm -f -s $(APP_SERVICE) || true

test-start:
	$(DC) --profile test up -d $(TEST_SERVICE)

test-stop:
	$(DC) --profile test stop $(TEST_SERVICE) || true

test-restart: test-stop test-start

test-logs:
	$(DC) --profile test logs -f $(TEST_SERVICE)

test-status:
	$(DC) --profile test ps $(TEST_SERVICE)

test-clean:
	$(DC) --profile test rm -f -s $(TEST_SERVICE) || true

test:
	$(DC) --profile test run --rm --build $(TEST_SERVICE)

test-unit:
	$(DC) --profile test run --rm --build $(TEST_SERVICE) npm run test:unit

test-integration:
	$(DC) --profile test run --rm --build $(TEST_SERVICE) npm run test:integration

test-coverage:
	$(DC) --profile test run --rm --build $(TEST_SERVICE) npm run test:coverage

clean:
	$(DC) --profile test down --remove-orphans
