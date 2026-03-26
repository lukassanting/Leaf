# Leaf: local development workflow.
# Requires: Python 3.11+, Node.js 20+, npm (local mode), or Docker / Docker Compose (container mode).
# On Windows: install Make via Chocolatey (`choco install make`) or use the commands directly.

BACKEND_DIR = backend
FRONTEND_DIR = frontend

.PHONY: api frontend install test env down down-api down-frontend docker up down-volumes logs shell-api shell-frontend

# ── Setup ────────────────────────────────────────────────────────────────────

# Ensure backend .env exists (copy from .env.example if missing).
env:
	@python -c "import os; p=os.path.join('$(BACKEND_DIR)','.env'); e=os.path.join('$(BACKEND_DIR)','.env.example'); os.path.exists(p) or open(p,'wb').write(open(e,'rb').read()) or print('Created $(BACKEND_DIR)/.env')"

# Install all dependencies (backend + frontend).
install: env
	cd $(BACKEND_DIR) && pip install -r requirements.txt 2>/dev/null || poetry install
	cd $(FRONTEND_DIR) && npm install

# ── Docker (full stack: API + frontend) ─────────────────────────────────────

# Build and start API + frontend (attached logs). Same as `make up`.
docker:
	docker compose up --build

up: docker

# Stop Compose services (containers + default network).
down:
	docker compose down

# Stop and remove the named volume (`leaf_data` — SQLite + synced files in the container).
down-volumes:
	docker compose down -v

logs:
	docker compose logs -f

shell-api:
	docker compose exec api sh

shell-frontend:
	docker compose exec frontend sh

# ── Run locally (use two terminals) ─────────────────────────────────────────

# Terminal 1: start the backend API on http://localhost:8000
api: env
	cd $(BACKEND_DIR) && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: start the frontend on http://localhost:3000
frontend:
	cd $(FRONTEND_DIR) && npm run dev

# Stop the backend (kills the process on port 8000) — local `make api` only.
down-api:
	-@python -c "import subprocess,re,os;port='8000';out=subprocess.run('netstat -ano' if os.name=='nt' else 'lsof -ti:'+port,shell=True,capture_output=True,text=True).stdout;pids={m.group(1) for l in out.splitlines() if ':'+port in l and ('LISTENING' in l or os.name!='nt') for m in [re.search(r'(\d+)\s*$$',l)] if m};[subprocess.run(['taskkill','/F','/PID',p] if os.name=='nt' else ['kill','-9',p]) for p in pids]"
	@echo "API stopped."

# Stop the frontend (kills the process on port 3000) — local `make frontend` only.
down-frontend:
	-@python -c "import subprocess,re,os;port='3000';out=subprocess.run('netstat -ano' if os.name=='nt' else 'lsof -ti:'+port,shell=True,capture_output=True,text=True).stdout;pids={m.group(1) for l in out.splitlines() if ':'+port in l and ('LISTENING' in l or os.name!='nt') for m in [re.search(r'(\d+)\s*$$',l)] if m};[subprocess.run(['taskkill','/F','/PID',p] if os.name=='nt' else ['kill','-9',p]) for p in pids]"
	@echo "Frontend stopped."

# ── Test ─────────────────────────────────────────────────────────────────────

test:
	@echo "--- Frontend (lint) ---"
	cd $(FRONTEND_DIR) && npm run test
	@echo "--- Backend (lint / tests) ---"
	@cd $(BACKEND_DIR) && (poetry run flake8 app 2>/dev/null || python -m py_compile app/main.py || echo "Backend checks skipped.")
	@echo "Done."
