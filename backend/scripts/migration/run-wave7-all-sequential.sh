#!/usr/bin/env bash
set -euo pipefail
cd /var/www/DRM_raya/backend
LOG=/tmp/wave7-migrate.log
exec >>"$LOG" 2>&1
echo "=== Wave 7 start $(date -Iseconds) ==="
MODULES=(create_project servicepool visit_meeting cheque_system penalty notice_board advance_salary dollar_pay pay_loan donation allowed_ip)
for m in "${MODULES[@]}"; do
  echo "--- module $m $(date -Iseconds) ---"
  node scripts/migration/run-wave7-batch-transform.mjs --execute-staging --module="$m" --batch-size=3000
done
echo "=== Wave 7 done $(date -Iseconds) ==="
