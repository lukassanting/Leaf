# `backend/app` Overview

This folder is the FastAPI backend implementation for Leaf.

## Major parts

- `main.py`: FastAPI app entrypoint (lifespan, CORS, middleware, router mounting).
- `config.py`: environment/config loading and typed config (`ConfigSettings`).
- `api/routes/`: API controllers (leaf + database endpoints).

Most business logic lives in:

- `database/models/*`
- `database/operations/*`
- `storage/*`

