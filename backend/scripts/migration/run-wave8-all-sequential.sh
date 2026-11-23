#!/usr/bin/env bash
# Wave 8 — all unmapped legacy_archive tables with <=1000 rows → legacy_archive_payload
set -euo pipefail
cd /var/www/DRM_raya/backend
LOG=/tmp/wave8-migrate.log
exec >>"$LOG" 2>&1
echo "=== Wave 8 start $(date -Iseconds) ==="
node scripts/migration/run-wave8-small-archive-transform.mjs \
  --execute-staging \
  --module=all \
  --max-rows=1000 \
  --batch-size=2000
echo "=== Wave 8 done $(date -Iseconds) ==="
