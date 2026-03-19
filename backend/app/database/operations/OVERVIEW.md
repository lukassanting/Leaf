# `backend/app/database/operations` Overview

This folder contains the “business logic” that controllers call.

It typically includes:

- CRUD for leaves and their relationships (`leaf_operations.py`)
- CRUD for databases, rows, and row cell updates (`database_operations.py`)

These operations map between DTOs and persistence models.

