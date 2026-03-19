# `backend/app/api/routes` Overview

This folder contains the top-level **API router wiring**.

- `api.py` mounts the leaf and database controller routers.
- Controllers under `leaf/` and `database/` define the concrete HTTP routes and delegate to `*Operations` classes.

