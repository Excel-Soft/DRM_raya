# Patch 3 — UAT Sign-off Matrix (Stage 11, Task J)

Tester worksheet for User Acceptance Testing of the Patch 3 surfaces. Fill
**Tested by** / **Status** / **Notes** per row during an interactive UAT session.

**Status legend:** ✅ Pass · ❌ Fail · ⏳ Pending · ⚠️ Pass-with-notes ·
🚫 NOT EXECUTED — requires role-specific UAT login (auth-gated; cannot be run from
the build environment).

**Honesty rule.** Rows are pre-filled with **Evidence** (the automated test or
code inspection that backs the *expected* result). They are **not** pre-marked
Pass. Interactive role-based rows stay ⏳/🚫 until a human signs them off — no
fabricated PASS. Run the automated suite first (`npm test`) and the API smoke
(`scripts/api-smoke-test.ts`, needs a running server + admin token), then use this
sheet with `PATCH3_PERMISSION_QA_MATRIX.md`, `MANUAL_QA_CHECKLIST.md`, and
`REPORT_CATALOG.md`.

| Module | Scenario | Role | Route | Expected result | Evidence (this stage) | Tested by | Status |
|---|---|---|---|---|---|---|---|
| Auth/RBAC | Valid login | any | `/login` | Redirect to role dashboard, JWT issued | Code inspection | | ⏳ |
| Auth/RBAC | Invalid credentials | any | `POST /api/auth/login` | 401 sanitized envelope, no 500 | Code inspection; smoke (unauth) | | ⏳ |
| Auth/RBAC | Expired/invalid token | any | any protected | Redirect to login; 401 `/api/auth/me` | Smoke (401 unauth) | | ⏳ |
| Auth/RBAC | Low-priv hits admin URL | low-priv | admin-only route | Blocked/redirected; no data leak | `report-permission.test.ts` (fail-closed) | | 🚫 |
| Audit | Audit viewer access | admin/super_hod | `/admin/audit-logs` | List renders, filters work, read-only | Code inspection; smoke (unauth 401) | | ⏳ |
| Audit | Audit viewer denied | non-privileged | `/api/audit-logs` | 403 | Code inspection (`requireRole`) | | 🚫 |
| Reports | Raw-attendance view/export | accounts/hr/hod | `/reports/raw-attendance` | View renders; export ⊆ view (HOD no export) | `report-permission.test.ts` | | 🚫 |
| Reports | Salary run + export | hr/accounts | salary screens | Real data; HR cannot finalize/mark_paid | `salary-routes.test.ts` | | 🚫 |
| Reports | Event/Reception | accounts/reception mgr | `/reports/event`,`/reception` | Renders; export scoped to view | `stage8-event-reception.test.ts` | | 🚫 |
| Reports | Day-target | mgmt | `/reports/day-target` | Real data (not 501); export accounts/hod | `report-permission.test.ts` | | 🚫 |
| Reports | Diagnose | any (scoped) | `/reports/diagnose` | View own/team/all by role; export restricted | Code inspection | | 🚫 |
| Reports | BV report CRUD/approve | sales chain/accounts | `/reports/bv`,`/bv-reports` | View/create/edit scoped; approve gated | `stage9-bv-report.test.ts` | | 🚫 |
| Reports | Export contents | manager+ | any report `/export` | Timestamped file; rows = list filters+scope; **no mock/hidden data** | Code inspection + `EXPORT_STANDARD.md` | | ⏳ |
| Penalty | Create / decide / void | hod/managerial | penalty pages + API | create=full/hod/mgr; decide/void=full/hod; `void` needs reason | `penalty-routes.test.ts` | | 🚫 |
| Workflow | Posting/Software transitions | manager chain | posting→QA→verif | Legal-state transitions, mandatory fields | `workflow-transition.service.test.ts` | | 🚫 |
| Service | Commission Verifications | service_manager | Service Mgr dashboard → Commission Verifications | **Honest empty state** — no fabricated total, no mock/empty export | Code (Stage 11 fix) | | ⏳ |
| Service | GM/VAS/BV bridge | service_* | `POST /api/service/gm\|vas\|bv` | 501 Not Implemented (honest; use GM/VAS/BV modules) | Code inspection | | ⏳ |
| Invoices | Change invoice status | accounts | `PATCH /api/account/invoices/:id/status` | **Known gap (APR-001/INV-001 OPEN):** no role gate / no state machine — confirm with business before relying | Code inspection | | ❌* |
| Admin | User management | admin | `/users` | List renders; CRUD audited; no password leak | Code inspection | | 🚫 |

`* ` invoice-status row is marked ❌ to reflect a real, documented open gap (not a
test failure introduced this stage); it is owned by Patch 3 Stage 1, not Stage 11.

## Cross-cutting (verify once, applies to all rows)
- [ ] Every `/api/*` response carries `X-Request-Id`; failures quote `rid=`.
- [ ] No 5xx leaks stack/SQL/secrets (sanitized envelope) — `stage10-smoke.test.ts`.
- [ ] Mutations write audit rows (see `AUDIT_LOG_EVENTS.md`).
- [ ] No export emits mock/hidden/static data (see `EXPORT_STANDARD.md`,
      `MOCK_STATIC_SCREEN_INVENTORY.md`).
- [ ] `MOCK_AUTH` unset in prod (server refuses to boot if `MOCK_AUTH=true` &&
      `NODE_ENV=production`); `/api/debug/fakhar` not mounted.

## Sign-off
- UAT owner: ______________  Date: __________  Overall: ☐ Go ☐ No-go
- Security pre-conditions for **Go** (must be resolved first, see final report §9):
  SEC-006 (JWT secret), SEC-005 (attributes route audit), APR-001/INV-001
  (invoice status gate), GLOBAL-003 (raw-body allow-lists).
