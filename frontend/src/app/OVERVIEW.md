# `frontend/src/app` Overview

This folder contains the Next.js **App Router** entrypoints for Leaf.

## What’s in here

- `layout.tsx`: root layout (global HTML shell, font setup, global metadata).
- `(workspace)/`: workspace-scoped UI shell and pages that render inside the shared sidebar/focus/AI providers.

## How to navigate it

- If you’re changing global app shell behavior, start with `layout.tsx`.
- If you’re changing “within-workspace” UI (sidebars, focus mode, AI companion), start with `(workspace)/layout.tsx`.
- If you’re editing a specific route, read that folder’s `page.tsx` (or `loading.tsx` for loading boundaries).

