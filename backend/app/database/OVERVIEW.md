# `backend/app/database` Overview

This folder contains persistence and query logic for Leaf, backed by MySQL.

Subfolders:

- `models/`: SQLAlchemy models for Leaf tree, databases, and flexible row properties.
- `operations/`: business logic for reading/writing model data (used by controllers).
- `connectors/`: DB connector implementations (and schema initialization).

