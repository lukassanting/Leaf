/**
 * Leaf frontend: API base URL resolver (`frontend/src/lib/apiBase.ts`).
 *
 * Purpose:
 * - Computes `API_BASE_URL` from `NEXT_PUBLIC_API_URL` (with trailing slash trimmed).
 * - Falls back to `http://localhost:8000` for local development.
 *
 * How to read:
 * - Follow the `raw` constant: it checks for `process.env?.NEXT_PUBLIC_API_URL`.
 * - Then see the ternary that decides “use env var” vs “use localhost”.
 *
 * Update:
 * - To change the default dev backend URL, edit the fallback string.
 * - If you need to support additional env-var formats, update the `replace(/\/$/, '')` logic.
 *
 * Debug:
 * - If API calls go to the wrong host, log/verify `NEXT_PUBLIC_API_URL` in the browser build.
 * - Confirm there aren’t double slashes in request URLs (the trailing slash trim prevents this).
 */
const raw = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL
export const API_BASE_URL =
  typeof raw === 'string' && raw.trim() !== ''
    ? raw.trim().replace(/\/$/, '')
    : 'http://localhost:8000'
