#!/usr/bin/env bash
# Resume partial ETL modules to 100% after rule relaxations
set -euo pipefail
cd /var/www/DRM_raya/backend
LOG=/tmp/partial-complete-migrate.log
exec >>"$LOG" 2>&1
echo "=== partial complete start $(date -Iseconds) ==="

run5() {
  echo "--- wave5 $1 $(date -Iseconds) ---"
  node scripts/migration/run-wave5-highvolume-transform.mjs --execute-staging --module="$1" --batch-size=8000
}

run5 raw_attendence
run5 task_assign
run5 task_links

echo "--- gmaccount $(date -Iseconds) ---"
node scripts/migration/run-wave6-batch-transform.mjs --execute-staging --module=gmaccount --batch-size=3000

echo "--- leads $(date -Iseconds) ---"
node scripts/migration/run-leads-transform.mjs --execute-staging --batch-size=5000

echo "--- attendance month history $(date -Iseconds) ---"
node scripts/migration/run-attendance-month-transform.mjs --execute-staging --history-only --batch-size=3000

echo "--- attributes $(date -Iseconds) ---"
node scripts/migration/run-attributes-transform.mjs --execute-staging --batch-size=100

echo "--- payments $(date -Iseconds) ---"
node scripts/migration/run-payments-transform.mjs --execute-staging --batch-size=2000

echo "=== partial complete done $(date -Iseconds) ==="
