# `frontend/src/lib/api` Overview

This folder contains typed API client modules and model/type helpers used by hooks and routes.

Typical usage:

- `frontend/src/app/*` pages call `*Api` methods either directly or indirectly through hooks.
- Hooks update local state and persist changes via mutation helpers that wrap these clients.

