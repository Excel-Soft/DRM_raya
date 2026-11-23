#!/usr/bin/env bash
# Wave 8b — remaining unmapped archive (no tbl_*; skips tables already partial/full via SQL)
set -euo pipefail
cd /var/www/DRM_raya/backend
LOG=/tmp/wave8b-migrate.log
exec >>"$LOG" 2>&1
echo "=== Wave 8b start $(date -Iseconds) ==="
node scripts/migration/run-wave8-small-archive-transform.mjs \
  --execute-staging \
  --module=all \
  --max-rows=250000 \
  --batch-size=5000
echo "=== Wave 8b done $(date -Iseconds) ==="
