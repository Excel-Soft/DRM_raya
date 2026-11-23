#!/usr/bin/env bash
# Run on your Mac (not production VPS). Requires SSH tunnel to VPS Postgres:
#   ssh -N -L 55432:127.0.0.1:5432 YOUR_USER@YOUR_VPS_HOST
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy backend/.env.staging-tunnel.example → backend/.env"
  exit 1
fi

if ! grep -E 'drm_legacy_stage(/|\?|$)' "$ENV_FILE" >/dev/null; then
  echo "ERROR: backend/.env must end with database drm_legacy_stage (not drm_postgres / Supabase)."
  echo "Fix DATABASE_URL=.../drm_legacy_stage then re-run."
  exit 1
fi

if ! (echo >/dev/tcp/127.0.0.1/55432) >/dev/null 2>&1; then
  echo "WARN: nothing listening on 127.0.0.1:55432 — start SSH tunnel first."
fi

cleanup() {
  [[ -n "${BACK_PID:-}" ]] && kill "$BACK_PID" 2>/dev/null || true
  [[ -n "${FRONT_PID:-}" ]] && kill "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Starting backend (port 5001) with $ENV_FILE ..."
(cd "$ROOT/backend" && npm run dev) &
BACK_PID=$!

sleep 2

FRONTEND_PORT="${FRONTEND_PORT:-5173}"
echo "Starting frontend (port $FRONTEND_PORT) ..."
(cd "$ROOT/frontend" && npm run dev -- --port "$FRONTEND_PORT") &
FRONT_PID=$!

echo "Backend PID=$BACK_PID  Frontend PID=$FRONT_PID"
echo "Open http://localhost:${FRONTEND_PORT}/auth — Ctrl+C stops both."

wait
