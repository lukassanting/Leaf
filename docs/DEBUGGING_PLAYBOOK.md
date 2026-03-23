# Leaf Debugging Playbook

This is a practical debug flow for shipping safe changes across the API + frontend stack.

## 1) Reproduce quickly

- Keep reproduction steps minimal and deterministic.
- Capture exact endpoint, route, and payload involved.
- Prefer one failing behavior at a time.

## 2) Trace the request path end-to-end

For page editor issues, use this path:

1. `frontend/src/app/(workspace)/editor/[id]/page.tsx`
2. `frontend/src/hooks/useLeafPageData.ts` or `frontend/src/hooks/useLeafAutosave.ts`
3. `frontend/src/lib/api/leaves.ts`
4. `backend/app/api/routes/leaf/leaf_crud_controller.py`
5. `backend/app/database/operations/leaf_operations.py`

For database issues, swap to:

- `frontend/src/hooks/useDatabasePage.ts`
- `frontend/src/lib/api/databases.ts`
- `backend/app/api/routes/database/database_controller.py`
- `backend/app/database/operations/database_operations.py`

## 3) Validate assumptions with runtime evidence

- Browser devtools: inspect request/response body for the failing call.
- API logs: confirm endpoint timing and status behavior.
- Database/storage: verify the persisted payload after the request.

## 4) Apply the smallest fix

- Change the first incorrect boundary only (DTO, mapper, hook, or UI).
- Avoid parallel refactors during bug fixing.

## 5) Verify and harden

- Run `make test` from repo root.
- Run targeted checks (`npm run lint`, container-side backend compile checks, or focused e2e).
- Update docs when behavior or workflow changed.

## Worked example: Windows `make test` backend step failure

### Reproduction

- Command: `make test` from repo root on Windows.
- Frontend lint succeeded, backend phase failed before checks ran.

### Root cause path

1. Entry point: `Makefile` target `test`.
2. Backend command used Unix-specific constructs:
   - `2>/dev/null`
   - `true`
3. On Windows `cmd`, those tokens are invalid:
   - `/dev/null` path does not exist
   - `true` is not a recognized command
4. Result: the backend-check step failed even when fallback behavior was intended.

### Fix

- Updated `Makefile` backend line to use shell-agnostic fallback behavior:
  - try `poetry run flake8 app`
  - else try `poetry run python -m py_compile app/main.py`
  - else print a skip message when Poetry is unavailable

### Verification

- Re-ran `make test` on Windows.
- Frontend lint ran, backend step produced a clear skip message, and the target completed successfully.
