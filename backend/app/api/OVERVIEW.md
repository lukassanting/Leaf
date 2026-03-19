# `backend/app/api` Overview

This folder is the HTTP layer for Leaf.

- `routes/`: mounts controller modules that implement concrete endpoints.
- Controllers delegate request handling to `database/operations/*`.

