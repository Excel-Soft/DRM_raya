#!/usr/bin/env bash
# Live migration status + loud errors when batch stopped
#   ./migration-live-status.sh
#   ./migration-live-status.sh --watch
#   ./migration-live-status.sh --errors     # only runner + error (no table spam)
set -euo pipefail

WATCH=false
ERRORS_ONLY=false
[[ "${1:-}" == "--watch" ]] && WATCH=true
[[ "${1:-}" == "--errors" ]] && ERRORS_ONLY=true
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COUNTS_JSON="${ROOT}/docs/migration/source-row-counts.json"
[[ -f /var/www/DRM_raya/docs/migration/source-row-counts.json ]] && COUNTS_JSON=/var/www/DRM_raya/docs/migration/source-row-counts.json

module_to_legacy() {
  case "$1" in
    task_links) echo webxl_task_links ;;
    follow_up_services) echo webxl_follow_up_services ;;
    com_history) echo webxl_com_history ;;
    com_detail) echo webxl_com_detail ;;
    last_followup) echo webxl_last_followup ;;
    raw_attendence) echo webxl_raw_attendence ;;
    posting_data) echo webxl_posting_data ;;
    task_assign) echo webxl_task_assign ;;
    task_log_history) echo webxl_task_log_history ;;
    departments) echo webxl_department ;;
    roles) echo webxl_role ;;
    gmaccount) echo webxl_gmaccount ;;
    gmaccount_history) echo webxl_gmaccount_history ;;
    verify_gm_cash) echo webxl_verify_gm_cash ;;
    verify_gm_delay) echo webxl_verify_gm_delay_amount ;;
    invoice_item_pay) echo webxl_invoice_item_pay ;;
    posting_keywords) echo webxl_posting_keywords ;;
    posting_mimg) echo webxl_posting_mimg ;;
    leave) echo webxl_leave ;;
    overtime) echo webxl_overtime ;;
    expense) echo webxl_expense ;;
    complaints) echo webxl_complaints ;;
    create_project) echo webxl_create_project ;;
    servicepool) echo webxl_servicepool ;;
    visit_meeting) echo webxl_visit_meeting ;;
    cheque_system) echo webxl_cheque_system ;;
    penalty) echo webxl_penalty ;;
    notice_board) echo webxl_notice_board ;;
    advance_salary) echo webxl_addvance_salary ;;
    dollar_pay) echo webxl_dollar_pay ;;
    pay_loan) echo webxl_pay_loan ;;
    donation) echo webxl_donation ;;
    allowed_ip) echo webxl_drm_allowed_ip ;;
    *) echo "" ;;
  esac
}

# Prints migration health: RUNNING | STOPPED_ERROR | STOPPED_OK | IDLE
analyze_log() {
  local log="$1"
  [[ -f "$log" ]] || return
  if grep -q '=== Wave.*done' "$log" 2>/dev/null; then
    if tail -20 "$log" | grep -q '^error:'; then
      echo "STOPPED_ERROR"
    else
      echo "STOPPED_OK"
    fi
    return
  fi
  if tail -30 "$log" | grep -q '^error:'; then
    echo "STOPPED_ERROR"
    return
  fi
  echo "IDLE"
}

last_failed_module() {
  local log="$1"
  [[ -f "$log" ]] || return
  awk '
    /^--- module / { mod=$3 }
    /^error:/ { if (mod != "") { print mod; exit } }
  ' "$log"
}

last_error_message() {
  local log="$1"
  [[ -f "$log" ]] || return
  grep '^error:' "$log" 2>/dev/null | tail -1 | sed 's/^error: //'
}

render() {
  clear 2>/dev/null || true
  local RUNNING=false
  local line=""
  if line=$(pgrep -af 'run-wave[5678].*transform|run-wave[5678]-all-sequential' 2>/dev/null | grep -v 'grep' | head -1); then
    RUNNING=true
  fi

  # Pick newest log with activity
  ACTIVE_LOG=""
  for log in /tmp/partial-complete-migrate.log /tmp/wave8b-migrate.log /tmp/wave8-migrate.log /tmp/wave7-migrate.log /tmp/wave6-migrate.log /tmp/wave5-migrate.log; do
    [[ -f "$log" ]] || continue
    ACTIVE_LOG="$log"
    break
  done

  local HEALTH="IDLE"
  [[ -n "$ACTIVE_LOG" ]] && HEALTH=$(analyze_log "$ACTIVE_LOG")

  echo "╔══════════════════════════════════════════════════════════════╗"
  echo "║  DRM staging migration — LIVE  $(date '+%H:%M:%S %d-%b-%Y')       ║"
  echo "╚══════════════════════════════════════════════════════════════╝"
  echo

  if $RUNNING; then
    echo "▶ STATUS: RUNNING (counts updating — keep this watch open)"
    if echo "$line" | grep -qE -- '--module='; then
      local mod
      mod=$(echo "$line" | sed -n 's/.*--module=\([a-z_0-9]*\).*/\1/p' | head -1)
      echo "   Module: $mod → $(module_to_legacy "$mod")"
    fi
  elif [[ "$HEALTH" == "STOPPED_ERROR" ]]; then
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  !! MIGRATION STOPPED ON ERROR — fix required !!               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    local fail_mod errmsg
    fail_mod=$(last_failed_module "$ACTIVE_LOG")
    errmsg=$(last_error_message "$ACTIVE_LOG")
    echo "   Failed module: ${fail_mod:-unknown}"
    echo "   Legacy table:  $(module_to_legacy "$fail_mod")"
    echo "   Error:         ${errmsg:-see log}"
    echo "   Log file:      ${ACTIVE_LOG}"
    echo "   Fix script, then:"
    echo "     sudo -u postgres bash /var/www/DRM_raya/backend/scripts/migration/run-wave8-all-sequential.sh"
    echo ""
    echo "   Quick detail:  tail -30 ${ACTIVE_LOG}"
    echo ""
    if $ERRORS_ONLY || $WATCH; then
      echo "── (Use without --watch for full table list, or: $0 --errors) ──"
    fi
  elif [[ "$HEALTH" == "STOPPED_OK" ]]; then
    echo "✓ STATUS: batch finished (check log for Wave N done)"
  else
    echo "■ STATUS: idle — no runner; data frozen until next ETL start"
  fi
  echo

  if $ERRORS_ONLY; then
  if [[ "$HEALTH" != "STOPPED_ERROR" ]] && ! $RUNNING; then
    echo "No blocking error in latest log tail."
  fi
    return 0
  fi

  if ! $RUNNING && [[ "$HEALTH" == "STOPPED_ERROR" ]]; then
    echo "── Last errors in ${ACTIVE_LOG} (newest) ──"
    grep '^error:' "$ACTIVE_LOG" 2>/dev/null | tail -3 | sed 's/^/  /'
    echo
    echo "Tip: don't use --watch on errors; run:  $0 --errors"
    echo "     then fix + restart ETL once."
    echo
    return 0
  fi

  CURRENT_MOD=""
  CURRENT_LEGACY=""
  if $RUNNING && echo "$line" | grep -qE -- '--module='; then
    CURRENT_MOD=$(echo "$line" | sed -n 's/.*--module=\([a-z_0-9]*\).*/\1/p' | head -1)
    CURRENT_LEGACY=$(module_to_legacy "$CURRENT_MOD")
  fi

  echo "── Progress (updates only while RUNNING) ──"
  python3 - "$COUNTS_JSON" "$CURRENT_LEGACY" <<'PY'
import json, subprocess, sys
counts_path, current_legacy = sys.argv[1], sys.argv[2]
with open(counts_path) as f:
    archive = json.load(f)
raw = subprocess.check_output(
    ["sudo", "-u", "postgres", "psql", "-d", "drm_legacy_stage", "-tA", "-c",
     """SELECT legacy_table || E'\\t' || count(*)::text || E'\\t' || coalesce(max(created_at)::text, '')
        FROM migration_meta.migration_legacy_ids GROUP BY legacy_table"""],
    text=True,
)
rows = []
for line in raw.strip().splitlines():
    if not line.strip():
        continue
    p = line.split("\t")
    if len(p) < 2:
        continue
    lt, mig = p[0], int(p[1])
    arch = int(archive.get(lt, 0) or 0)
    pct = round(100.0 * mig / arch, 1) if arch else 100.0
    rows.append((lt, mig, arch, pct, p[2] if len(p) > 2 else ""))
rows.sort(key=lambda r: r[4] or "", reverse=True)
print(f"{'legacy_table':<36} {'migrated':>10} {'archive':>10} {'%':>7}")
for lt, mig, arch, pct, _ in rows[:12]:
    mark = " ◀" if lt == current_legacy else ""
    print(f"{lt:<36} {mig:>10} {arch:>10} {pct:>6.1f}%{mark}")
inc = [r for r in rows if r[2] > 0 and r[3] < 99.5]
if inc:
    print("\nIncomplete (expected rejects on some):")
    for lt, mig, arch, pct, _ in sorted(inc, key=lambda r: r[3])[:8]:
        print(f"  {lt}: {pct}%")
print(f"\nSources mapped: {len(rows)} / 166")
PY
  echo
  echo "Commands:  $0 --errors  |  $0 --watch (only while RUNNING)  |  tail -f ${ACTIVE_LOG:-/tmp/wave7-migrate.log}"
}

if $WATCH; then
  while true; do render; sleep 5; done
else
  render
fi
