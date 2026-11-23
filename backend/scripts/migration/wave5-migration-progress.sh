#!/usr/bin/env bash
# Wave 5 ETL progress (drm_legacy_stage). Run on VPS as root or postgres.
#   ./wave5-migration-progress.sh          # one snapshot
#   ./wave5-migration-progress.sh --watch  # refresh every 30s
set -euo pipefail

WATCH=false
[[ "${1:-}" == "--watch" ]] && WATCH=true

run_snapshot() {
  clear 2>/dev/null || true
  echo "══════════════════════════════════════════════════════════════"
  echo "  DRM Wave 5 migration progress — $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "══════════════════════════════════════════════════════════════"
  echo

  if pgrep -f 'run-wave5-all-sequential.sh' >/dev/null 2>&1; then
    echo "Runner:  ACTIVE (run-wave5-all-sequential.sh)"
  elif pgrep -f 'run-wave5-highvolume-transform.mjs --execute-staging' >/dev/null 2>&1; then
    echo "Runner:  ACTIVE (single module)"
  else
    echo "Runner:  NOT RUNNING"
  fi

  if pgrep -af 'run-wave5-highvolume-transform' 2>/dev/null | head -1 | grep -q module=; then
    pgrep -af 'run-wave5-highvolume-transform' 2>/dev/null | head -1 | sed 's/.*--module=/Current module: /; s/ --batch.*//'
  elif [[ -f /tmp/wave5-migrate.log ]]; then
    last_mod=$(grep -E '^--- module ' /tmp/wave5-migrate.log | tail -1 | sed 's/^--- module //; s/ .*//')
    if grep -q '=== Wave 5 done' /tmp/wave5-migrate.log 2>/dev/null; then
      echo "Current module: (all finished — see log)"
    else
      echo "Current module: ${last_mod:-unknown} (from log)"
    fi
  fi
  echo

  if [[ -f /tmp/wave5-migrate.log ]]; then
    echo "Log tail (/tmp/wave5-migrate.log):"
    tail -3 /tmp/wave5-migrate.log | sed 's/^/  /'
    echo
  fi

  sudo -u postgres psql -d drm_legacy_stage -P pager=off -c "
WITH archive AS (
  SELECT 'webxl_task_links' AS t, count(*)::bigint AS total FROM legacy_archive.webxl_task_links
  UNION ALL SELECT 'webxl_follow_up_services', count(*) FROM legacy_archive.webxl_follow_up_services
  UNION ALL SELECT 'webxl_com_history', count(*) FROM legacy_archive.webxl_com_history
  UNION ALL SELECT 'webxl_com_detail', count(*) FROM legacy_archive.webxl_com_detail
  UNION ALL SELECT 'webxl_last_followup', count(*) FROM legacy_archive.webxl_last_followup
  UNION ALL SELECT 'webxl_raw_attendence', count(*) FROM legacy_archive.webxl_raw_attendence
  UNION ALL SELECT 'webxl_posting_data', count(*) FROM legacy_archive.webxl_posting_data
  UNION ALL SELECT 'webxl_task_assign', count(*) FROM legacy_archive.webxl_task_assign
  UNION ALL SELECT 'webxl_task_log_history', count(*) FROM legacy_archive.webxl_task_log_history
),
mapped AS (
  SELECT legacy_table AS t, count(*)::bigint AS done
  FROM migration_meta.migration_legacy_ids
  WHERE legacy_table IN (SELECT t FROM archive)
  GROUP BY 1
)
SELECT a.t AS legacy_table,
       coalesce(m.done, 0) AS migrated,
       a.total AS archive_rows,
       round(100.0 * coalesce(m.done, 0) / nullif(a.total, 0), 1) AS pct_done
FROM archive a
LEFT JOIN mapped m ON m.t = a.t
ORDER BY a.t;
"

  echo
  echo "All Wave 5 modules with maps:"
  sudo -u postgres psql -d drm_legacy_stage -P pager=off -t -c "
    SELECT count(DISTINCT legacy_table) || ' / 9 wave5 tables touched'
    FROM migration_meta.migration_legacy_ids
    WHERE legacy_table IN (
      'webxl_task_links','webxl_follow_up_services','webxl_com_history','webxl_com_detail',
      'webxl_last_followup','webxl_raw_attendence','webxl_posting_data','webxl_task_assign','webxl_task_log_history'
    );
  "
  echo
  echo "Tip: watch live →  $0 --watch"
  echo "Full log:         tail -f /tmp/wave5-migrate.log"
}

if $WATCH; then
  while true; do
    run_snapshot
    sleep 30
  done
else
  run_snapshot
fi
