#!/bin/bash
set -e

# Post-merge setup for WebExcels DRM.
# Idempotent, non-interactive. Runs automatically after a task is merged.
#
# NOTE: This project intentionally does NOT run `db:push` — shared/schema.ts is
# deliberately out of sync with the live database, and schema changes are applied
# via explicit DDL migrations in migrations/. Running db:push here would break the
# live DB. Keep this script limited to dependency installation.

echo "[post-merge] Installing dependencies (npm ci-style, non-interactive)..."
npm install --no-audit --no-fund

echo "[post-merge] Done."
