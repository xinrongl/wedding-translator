.DEFAULT_GOAL := help
.PHONY: help install build app-up app-down docker-up docker-down lint format test check deploy allow proxy \
        .backend-install .frontend-install .frontend-build .backend-up .frontend-up .app-down .smoke .allow-public .allow-user \
        backend-install frontend-install frontend-build backend-up frontend-up smoke app-dcu app-dcd allow-public allow-user dev

# Load Single Source of Truth from .env if present
ENV_FILE ?= .env
ifneq (,$(wildcard $(ENV_FILE)))
  include $(ENV_FILE)
  export
endif

# Configuration variables — sourced from .env (Single Source of Truth); override on the CLI if needed
CLOUD_RUN_REGION ?= australia-southeast2
SERVICE_NAME ?= wedding-translator
GCP_ACCOUNT ?= $(shell gcloud config get-value account 2>/dev/null || echo "xinronglin@outlook.com")
UV := uv run
DOCKER_COMPOSE ?= $(shell which docker-compose 2>/dev/null || echo "docker compose")

##@ General
help: ## Show this help message
	@echo "Usage: make [target]"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2} /^##@/ {printf "\n\033[1;33m%s\033[0m\n", substr($$0, 5)}' $(MAKEFILE_LIST)

##@ Setup & Build
install: .backend-install .frontend-install ## Install both backend (uv) and frontend (npm) dependencies

.backend-install:
	uv sync

.frontend-install:
	npm --prefix src/app install

build: .frontend-build ## Build React frontend into src/app/dist for production serving

.frontend-build:
	npm --prefix src/app run build

##@ Development
app-up: .app-down ## Start both backend (port 8000) and frontend (port 5173) services
	@bash -c '\
		trap "fuser -k 8000/tcp 5173/tcp 2>/dev/null; kill 0" SIGINT SIGTERM EXIT; \
		$(UV) python -m translator.main & \
		npm --prefix src/app run dev & \
		wait'

app-down: .app-down ## Stop both backend and frontend processes (ports 8000 & 5173)

.app-down:
	@fuser -k 8000/tcp 5173/tcp 2>/dev/null || true
	@echo "App stopped."

docker-up: ## Build and start containerized app using Docker Compose (port 8080)
	@$(DOCKER_COMPOSE) up --build

docker-down: ## Stop and remove Docker Compose containers
	@$(DOCKER_COMPOSE) down

.backend-up:
	$(UV) python -m translator.main

.frontend-up:
	npm --prefix src/app run dev

##@ Code Quality & Testing
lint: ## Run ruff linter and formatting checks
	$(UV) ruff check .
	$(UV) ruff format --check .

format: ## Fix all fixable ruff errors, sort imports, and format code
	$(UV) ruff check --fix --select I .
	$(UV) ruff check --fix .
	$(UV) ruff format .

test: ## Run pytest test suite (use SMOKE=1 for smoke tests only)
	@if [ "$(SMOKE)" = "1" ]; then \
		$(UV) pytest -m smoke -v; \
	else \
		$(UV) pytest -v; \
	fi

check: lint test ## Run both linter checks and test suite

.smoke:
	$(UV) pytest -m smoke -v

##@ Deployment & Cloud Run
deploy: ## Build container and deploy to Google Cloud Run
	@export CLOUDSDK_AUTH_ACCESS_TOKEN="$$(gcloud auth application-default print-access-token 2>/dev/null || true)"; \
	TMP_ENV=$$(mktemp); \
	if [ -f "$(ENV_FILE)" ]; then \
		python3 -c "from dotenv import dotenv_values; import yaml; vals = {k: v for k, v in dotenv_values('$(ENV_FILE)').items() if k not in ['PORT', 'K_SERVICE', 'K_REVISION', 'K_CONFIGURATION'] and v is not None}; print(yaml.safe_dump(vals, allow_unicode=True))" > "$$TMP_ENV"; \
	else \
		touch "$$TMP_ENV"; \
	fi; \
	gcloud run deploy $(SERVICE_NAME) \
		--source . \
		--project $(GOOGLE_CLOUD_PROJECT) \
		--region $(CLOUD_RUN_REGION) \
		--allow-unauthenticated \
		--timeout 3600 \
		--memory 1Gi \
		--cpu 1 \
		--min-instances 0 \
		--max-instances 1 \
		--concurrency 250 \
		--no-cpu-throttling \
		--port 8080 \
		--env-vars-file "$$TMP_ENV"; \
	STATUS=$$?; \
	rm -f "$$TMP_ENV"; \
	exit $$STATUS

allow: ## Grant Cloud Run invoker role (default: current user, PUBLIC=1 for allUsers)
	@MEMBER="user:$(GCP_ACCOUNT)"; \
	if [ "$(PUBLIC)" = "1" ]; then MEMBER="allUsers"; fi; \
	echo "Granting roles/run.invoker to $$MEMBER on $(SERVICE_NAME)..."; \
	gcloud run services add-iam-policy-binding $(SERVICE_NAME) \
		--region=$(CLOUD_RUN_REGION) \
		--project=$(GOOGLE_CLOUD_PROJECT) \
		--member="$$MEMBER" \
		--role="roles/run.invoker"

proxy: ## Run authenticated localhost proxy to the Cloud Run service (port 8080)
	gcloud run services proxy $(SERVICE_NAME) --region=$(CLOUD_RUN_REGION) --project=$(GOOGLE_CLOUD_PROJECT) --port=8080

.allow-public:
	@$(MAKE) allow PUBLIC=1

.allow-user:
	@$(MAKE) allow PUBLIC=0

# Backward-compatibility & convenience aliases (hidden from help)
backend-install: .backend-install
frontend-install: .frontend-install
frontend-build: .frontend-build
backend-up: .backend-up
frontend-up: .frontend-up
dev: app-up
smoke: .smoke
app-dcu: docker-up
app-dcd: docker-down
allow-public: .allow-public
allow-user: .allow-user
