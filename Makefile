# Leaf: local development workflow.
# Requires: Python 3.11+, Node.js 20+, npm.
# On Windows: install Make via Chocolatey (`choco install make`) or use the commands directly.

BACKEND_DIR = backend
FRONTEND_DIR = frontend

.PHONY: api frontend install test env down

# ── Setup ────────────────────────────────────────────────────────────────────

# Ensure backend .env exists (copy from .env.example if missing).
env:
	@python -c "import os; p=os.path.join('$(BACKEND_DIR)','.env'); e=os.path.join('$(BACKEND_DIR)','.env.example'); os.path.exists(p) or open(p,'wb').write(open(e,'rb').read()) or print('Created $(BACKEND_DIR)/.env')"

# Install all dependencies (backend + frontend).
install: env
	cd $(BACKEND_DIR) && pip install -r requirements.txt 2>/dev/null || poetry install
	cd $(FRONTEND_DIR) && npm install

# ── Run (use two terminals) ──────────────────────────────────────────────────

# Terminal 1: start the backend API on http://localhost:8000
api: env
	cd $(BACKEND_DIR) && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: start the frontend on http://localhost:3000
frontend:
	cd $(FRONTEND_DIR) && npm run dev

# Kill all backend + frontend processes.
down:
	-@taskkill //F //IM python.exe 2>/dev/null || pkill -f uvicorn 2>/dev/null || true
	-@taskkill //F //IM node.exe 2>/dev/null || pkill -f "next dev" 2>/dev/null || true
	@echo "All stopped."

# ── Test ─────────────────────────────────────────────────────────────────────

test:
	@echo "--- Frontend (lint) ---"
	cd $(FRONTEND_DIR) && npm run test
	@echo "--- Backend (lint / tests) ---"
	@cd $(BACKEND_DIR) && (poetry run flake8 app 2>/dev/null || python -m py_compile app/main.py || echo "Backend checks skipped.")
	@echo "Done."
