#!/usr/bin/env bash
# Run all Wave 5 modules on drm_legacy_stage (postgres). Idempotent.
set -euo pipefail
cd /var/www/DRM_raya/backend
LOG=/tmp/wave5-migrate.log
exec >>"$LOG" 2>&1
echo "=== Wave 5 start $(date -Iseconds) ==="
MODULES=(task_links follow_up_services com_history com_detail last_followup raw_attendence posting_data task_assign task_log_history)
for m in "${MODULES[@]}"; do
  echo "--- module $m $(date -Iseconds) ---"
  (
    while kill -0 "$$" 2>/dev/null; do
      sleep 120
      bash scripts/migration/wave5-migration-progress.sh 2>/dev/null | tail -n +4 | head -20 | sed 's/^/[progress] /'
    done
  ) &
  heartbeat=$!
  node scripts/migration/run-wave5-highvolume-transform.mjs --execute-staging --module="$m" --batch-size=8000
  kill "$heartbeat" 2>/dev/null || true
  wait "$heartbeat" 2>/dev/null || true
  echo "--- module $m finished $(date -Iseconds) ---"
  bash scripts/migration/wave5-migration-progress.sh 2>/dev/null | tail -25 | sed 's/^/[summary] /'
done
echo "=== Wave 5 done $(date -Iseconds) ==="
