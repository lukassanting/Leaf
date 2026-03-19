"""
Database package (`backend/app/database`).

Purpose:
- Provides the persistence layer used by the FastAPI backend.

How to read:
- `connectors/`: DB engine/session + schema initialization
- `models/`: SQLAlchemy ORM models
- `operations/`: business logic that controllers call

Update:
- If you introduce new persistence behavior, implement it in `operations/*` and call it from controllers.

Debug:
- If database writes/reads fail, check connector/table initialization in `connectors/mysql.py` and JSON column mappings in `models/mysql_models.py`.
"""

"""
Database package for Leaf API Service
""" 