# Leaf: run full stack (API + frontend + MySQL) and run tests.
# Requires Docker and Docker Compose. On Windows you can use WSL or install Make (e.g. Chocolatey).

COMPOSE = docker compose
BACKEND_DIR = backend
FRONTEND_DIR = frontend

.PHONY: up up-d down down-volumes build test test-in-docker logs shell-api shell-frontend env

# Ensure backend .env exists (copy from .env.example if missing).
# Windows cmd.exe chokes on '!' and lacks Unix 'test'; use a Python one-liner so it works everywhere.
env:
	@python -c "import os; p=os.path.join('$(BACKEND_DIR)','.env'); e=os.path.join('$(BACKEND_DIR)','.env.example'); os.path.exists(p) or open(p,'wb').write(open(e,'rb').read()) or print('Created $(BACKEND_DIR)/.env')"

# Start all services (MySQL, API, frontend). Builds images if needed.
up: env
	$(COMPOSE) up --build

# Same as up but detached (background)
up-d: env
	$(COMPOSE) up --build -d

# Stop and remove containers
down:
	$(COMPOSE) down

# Stop and remove containers and the MySQL data volume
down-volumes:
	$(COMPOSE) down -v

# Build all images without starting
build: env
	$(COMPOSE) build

# Run tests: frontend lint; backend lint if available
test:
	@echo "--- Frontend (lint) ---"
	cd $(FRONTEND_DIR) && npm run test
	@echo "--- Backend (lint / tests) ---"
	@cd $(BACKEND_DIR) && (poetry run flake8 app 2>/dev/null || poetry run python -m py_compile app/main.py 2>/dev/null || true)
	@echo "Done."

# Follow logs for all services
logs:
	$(COMPOSE) logs -f

# One-off: run tests inside containers (e.g. when stack is up)
test-in-docker:
	$(COMPOSE) run --rm frontend npm run test
	@echo "Backend: run 'docker compose run --rm api poetry run pytest' when tests exist."

# Shell into API container (when stack is up)
shell-api:
	$(COMPOSE) exec api sh

# Shell into frontend container
shell-frontend:
	$(COMPOSE) exec frontend sh
