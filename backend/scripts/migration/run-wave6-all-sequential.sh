#!/usr/bin/env bash
# Wave 6 + finish Wave 5 partials + payments tail
set -euo pipefail
cd /var/www/DRM_raya/backend
LOG=/tmp/wave6-migrate.log
exec >>"$LOG" 2>&1
echo "=== Wave 6 start $(date -Iseconds) ==="

echo "--- Wave 5 partial resume ---"
for m in task_links task_assign com_detail com_history; do
  echo "resume wave5 $m"
  node scripts/migration/run-wave5-highvolume-transform.mjs --execute-staging --module="$m" --batch-size=8000 || true
done

echo "--- payments tail ---"
node scripts/migration/run-payments-transform.mjs --execute-staging --batch-size=500 || true

MODULES=(departments roles gmaccount gmaccount_history verify_gm_cash verify_gm_delay invoice_item_pay posting_keywords posting_mimg leave overtime expense complaints)
for m in "${MODULES[@]}"; do
  echo "--- module $m $(date -Iseconds) ---"
  node scripts/migration/run-wave6-batch-transform.mjs --execute-staging --module="$m" --batch-size=3000
done
echo "=== Wave 6 done $(date -Iseconds) ==="
