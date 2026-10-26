# Phase 0A/0B/0C — Route reconciliation report (see phase-0-exit-record.md for closure)

**Branch:** `fix/upgrade_frontend_habib`  
**Regenerate:** `node frontend-next/scripts/build-route-matrix.mjs`

---

## 1. Sources audited

| Source | Path |
|--------|------|
| Route registry | `frontend/src/routes/route-registry.ts` |
| App wiring | `frontend/src/App.tsx` |
| Sidebar | `frontend/src/components/app-sidebar.tsx` |
| Client guard | `frontend/src/hooks/useRouteProtection.ts` |
| Backend mounts | `backend/src/server/routes.ts` |
| Auth evidence (partial) | `auth-mapping-backlog.json` |
| Phase 0B resolutions | `phase-0b-resolution.md` |
| Phase 0C critical audit | `phase-0c-critical-audit.md` |

---

## 2. Counts (last generator run — use meta.generatedAt in JSON)

| Metric | Actual |
|--------|--------|
| Registry entries | **207** |
| App.tsx declarations | **207** |
| Union unique paths | **207** |
| Sidebar URL entries | **114** |
| App-only (missing registry) | **0** |
| Sidebar orphans | **1** (`/sales/active-clients`) |
| Migration tracker routes | **207** |

---

## 3. Phase 0B — twelve former App-only routes

**Resolved:** all twelve documented in `route-registry.ts` with code-cited notes.  
Details: **`phase-0b-resolution.md`**.

**Open product gap (0C confirmed):** `/approvals` — see §10.

---

## 4. Sidebar orphan

| URL | Status |
|-----|--------|
| `/sales/active-clients` | **Open** — sidebar only; no App route (see phase-0b-resolution.md) |

---

## 5. Aliases (unchanged — preserve in Next)

| From | To |
|------|-----|
| `/sales/temp-contact` | `/customer/temporary-contact` |
| `/projects` | `/drm/delay-project` |
| `/pms/settings` | `/drm/pms-setting` |
| `/dd-manager/project-report` | `/pms/project-report` |
| `/office/old-account-head` | `/office/chart-of-accounts` |
| `/office/account-head` | `/office/chart-of-accounts` |
| `/team-report/link-report` | `/posting-data/link-report` |

---

## 6. Authorization (Phase 0B/0C)

- **Partial map:** `auth-mapping-backlog.json` (18 entries; not 207×handlers).
- **0C confirmed critical:** `AUTH-APPROVALS-01` — unified `/approvals` UI calls stub `/api/approvals` (404); no in-app nav links; `CrossDepartmentStatusService` also stubbed.
- **0C confirmed high:** `AUTH-AUDIT-01` — `/admin/audit-logs` reachable by `service_manager` / `administrator` via `/admin` guard; `GET /api/audit-logs` allows only `admin`, `super_admin`, `super_hod`.
- Details: **`phase-0c-critical-audit.md`**.

---

## 7. Registry vs sidebar visibility (review items)

Paths with `sidebarVisible: true` in registry but no exact sidebar URL (may use `/dashboard`, role home, or alternate entry):

- `/`, `/pms/task-templates`, `/reports/bv-system`, `/reports/grade-system`, `/sale/commission-verification`, `/sales/customers`, `/sales/tracing`

**Status:** `review` — not blocking registry↔App alignment.

---

## 8. Phase 0 exit criteria

| Criterion | Status |
|-----------|--------|
| Route matrix + tracker | **Done** |
| App ↔ registry alignment | **Done** (0 App-only) |
| Sidebar orphan | **Open** |
| `/approvals` API stub | **Open (critical, 0C confirmed broken)** |
| `/admin/audit-logs` guard mismatch | **Legacy fixed** — Next port pending Phase 2 |
| Full backend auth map | **Open (backlog)** |
| Talha ownership confirmed | **Open** |
| Production Node / Nginx for Next | **Open** |

**Migration inventory:** see **`phase-0-exit-record.md`** — closed for planning; deployment/security audit not closed.

---

## 9. Validation

```bash
node frontend-next/scripts/build-route-matrix.mjs
node -e "JSON.parse(require('fs').readFileSync('frontend-next/docs/route-matrix/route-matrix.json'))"
cd frontend-next && npm run typecheck
```

---

## 10. Phase 0C — critical items summary

| Item | Finding | Pilot |
|------|---------|-------|
| `/approvals` | Page live; API stub; no sidebar/deep links | **Exclude** |
| `/admin/audit-logs` | Legacy guard aligned with API | Port to Next in Phase 2 |
| Working alternatives | `/pms/approvals`, `/api/hod/approvals` | OK for approval-adjacent pilots |

**Phase 0 is not closed.**
