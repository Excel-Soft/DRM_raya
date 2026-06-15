# Patch 3 — Permission QA Matrix (Stage 11, Task I)

**Purpose.** Per-route, per-action authorization for the Patch 3 surfaces,
expressed in the *normalized* role vocabulary used by the backend guards. This is
a QA artifact: it records the **expected** behavior (derived from the live guard
code) and the **verification method / result** for each row. It is honest about
what was actually executed this stage versus what still requires interactive UAT
or remains an open gap.

This document complements (does not replace) `PATCH2_PERMISSION_QA_MATRIX.md`,
which covers the Patch 2 report surfaces in full detail; the report/salary/penalty
rows below are summarized here and cross-referenced there.

## Verification legend (no fabricated results)

- **UNIT-TESTED (`file`)** — a Vitest file directly asserts the guard/decision for
  this route or its decision function.
- **VERIFIED BY CODE INSPECTION** — the guard was read in source this stage; no
  automated test covers it, but the code path is unambiguous.
- **SMOKE PASS** — exercised by `scripts/api-smoke-test.ts` against a running
  server with an admin token (only marked where actually run; see the final
  report §Tests for whether the smoke was executed this stage).
- **NOT EXECUTED — requires role-specific UAT login** — correctness depends on an
  interactive multi-role sign-in that is auth-gated (JWT) and cannot be run from
  the build environment. Tracked in `PATCH3_UAT_SIGNOFF_MATRIX.md`.
- **GAP (OPEN)** — code inspection found the expected guard is **missing or
  weaker** than required. Listed truthfully; the fix is owned by the indicated
  Patch 3 stage (see `PATCH3_ISSUE_MATRIX.md`), not Stage 11.

## Authorization systems in play

1. **Global auth** — `server/auth.middleware.ts` `authMiddleware` mounted at
   `server/routes.ts` (`app.use("/api", authMiddleware)`). Everything mounted
   **after** it requires a valid JWT. **Caveat (SEC-005, OPEN):** `attributesRoutes`
   is mounted *before* `authMiddleware`; each of its handlers must be confirmed
   intentionally public or gated locally.
2. **Report middleware** — `server/middleware/report-permission.ts`
   (`requireReportPermission(key, action)`), unit-tested by
   `server/report-permission.test.ts`. Fails closed (401/403, sanitized envelope).
3. **Salary class system** — `server/salary-routes.ts` (`CLASS_ACTIONS` /
   `salaryClassForRole` / `classCan`) + `resolveScope`, unit-tested by
   `server/salary-routes.test.ts`.
4. **Route-level helpers** — `server/penalty-routes.ts`,
   `server/diagnosis-report-routes.ts`, `server/audit-log-routes.ts`,
   action/RBAC middleware (`server/middleware/action-permission.ts`,
   `server/middleware/rbac.middleware.ts`).

Row-level scope (own/department/all) is applied **inside** handlers; a ✅ means
"the action is permitted at all" — visible rows may still be scoped.

## Matrix — authentication & admin surfaces

| Route | Action | Expected (allowed) | Guard (source) | Verification method | Result |
|---|---|---|---|---|---|
| `POST /api/auth/login` | login | public | `auth.routes.ts` | VERIFIED BY CODE INSPECTION | Invalid creds → 401 sanitized; no 500 |
| `GET /api/auth/me` | self | any authenticated | `authMiddleware` | VERIFIED BY CODE INSPECTION; SMOKE (401 when unauth) | Unauth → 401 (no user leak) |
| `GET /api/users*` | manage | admin only | `users-routes.ts` + RBAC | NOT EXECUTED — requires role-specific UAT login | Password/hash never serialized (inspection OK) |
| `GET /api/audit-logs` | view | `admin` / `super_admin` / `super_hod` | `audit-log-routes.ts` `requireRole(...)` | UNIT-/SMOKE-checked (unauth 401) + code inspection | Unauth → 401; non-privileged → 403; read-only over `drm.activity_logs`, params bound |

## Matrix — report / export surfaces (summary; full detail in Patch 2 matrix)

| Route | Action | Expected (allowed) | Guard | Verification method | Result |
|---|---|---|---|---|---|
| `/api/reports/raw-attendance` (+`/export`) | view / export | view: admin/super_hod/hod/accounts/hr; export: **no HOD** | `requireReportPermission("raw_attendance",…)` | UNIT-TESTED (`report-permission.test.ts`) | Export ⊆ view; CSV re-applies filters+scope |
| `/api/salary/*` (preview/runs/status/export) | per-action | salary **class system** (full/accounts/hr/hod/manager/executive) | `salary-routes.ts` `classCan` + `resolveScope` | UNIT-TESTED (`salary-routes.test.ts`) | HR may generate/export/cancel, **not** finalize/mark_paid; HOD view+approve; mgr/exec view-only scoped |
| `/api/reports/event` | view / CSV | accounts/hod + reception **manager** | `requireReportPermission("event_report",…)` | UNIT-TESTED (`stage8-event-reception.test.ts`) | CSV is client-side of visible scoped rows |
| `/api/reports/reception` (+`/export`) | view / export | reception mgr/exec (exec own-scope) + accounts/hod | `requireReportPermission("reception_report",…)` | UNIT-TESTED (`stage8-event-reception.test.ts`) | Export: reception **manager** + accounts only |
| `/api/reports/edit-att` | view/approve/finalize | reviewers; `hr_manager` (not plain `hr`) approves; finalize = accounts/hod | `requireReportPermission("edit_attendance",…)` | UNIT-TESTED (`report-permission.test.ts`) | Fail-closed |
| `/api/reports/day-target` (+`/export`) | view / export | broad mgmt view; export accounts/hod | `requireReportPermission("day_target",…)` | UNIT-TESTED (`report-permission.test.ts`) | Real data (former 501 stub replaced in Stage 4) |
| `/api/reports/diagnose` (+`/export`) | view / export | any authenticated views own/team/all by role; export admin/super_hod/accounts/hod | route-level `diagnosis-report-routes.ts` `accessLevel()`/`canExport()` | VERIFIED BY CODE INSPECTION; partial smoke | No role denied *view*; differ by scope |
| `/api/reports/bv`, `/api/bv-reports*` | view/create/edit/export/approve | sales chain + DnD + accounts; approve admin/super_hod/accounts/hod | `requireReportPermission("bv_report",…)` | UNIT-TESTED (`stage9-bv-report.test.ts`, `performance-routes.team.test.ts`) | Export ⊆ view |

## Matrix — penalty / workflow / cross-dept / invoice surfaces

| Route | Action | Expected (allowed) | Guard | Verification method | Result |
|---|---|---|---|---|---|
| `/api/penalties` (+report/void/delete) | create/view/decide/void/delete | route helpers: create=full/hod/managerial; decide/void=full/hod **only**; view report=full/hod/hr | `penalty-routes.ts` helpers | UNIT-TESTED (`penalty-routes.test.ts`) | `void` requires `reason` (audited); divergence from `report-permission.ts` `penalty_report` is **dead config** (B-04) |
| product-posting workflow transitions | transition | role + legal-state gated | `workflow-transition.service.ts` `assertWorkflowTransition` | UNIT-TESTED (`workflow-transition.service.test.ts`) | Centralized state machine + mandatory fields |
| software workflow transitions | transition | same as posting | shared transition service | UNIT-TESTED (`workflow-transition.service.test.ts`) | Same machine |
| `POST /api/service/gm\|vas\|bv` | create-bridge | — | `service-core-routes.ts` | VERIFIED BY CODE INSPECTION | **GAP (WF-003/XDL-002 OPEN):** returns **501 Not Implemented** (honest stub, no fake success); no frontend caller. Use GM/VAS/BV modules |
| `PATCH /api/account/invoices/:id/status` | change status | should be role/action-gated + state-machine validated | `account-routes.ts` | VERIFIED BY CODE INSPECTION | **GAP (APR-001/INV-001 OPEN):** only `if(!req.user)` — any authenticated user can set any status; no from→to validation. Fix owned by Stage 1, not Stage 11 |

## Open authorization gaps found this stage (truthful, not "PASS")

These are **not** Stage 11's remit (reports/exports/UI/QA/UAT). They are recorded
so the matrix is honest and the final report can list them as remaining:

- **APR-001 / INV-001 (P0, Stage 1):** `PATCH /api/account/invoices/:id/status`
  has no role/action gate and no status state machine on `drm.invoices`.
- **SEC-005 (P0, Stage 1):** `attributesRoutes` mounted before `authMiddleware`;
  per-handler public/gated audit still required.
- **SEC-006 (P0, Stage 1):** `JWT_SECRET` is hard-coded in `.replit` (violates
  `replit.md`). Must move to a Replit-managed secret and rotate (user-approved;
  invalidates sessions). Value intentionally not reproduced here.
- **GLOBAL-003 (P0, Stage 1):** raw `...req.body` spreads in
  `service-core-routes.ts` (4 sites) and `notice-routes.ts` (2 sites) — no zod
  allow-list.
- **WF-003 / XDL-002 (P0, Stage 2):** service→GM/VAS/BV bridges return 501.

## Verification basis

- Unit suites this stage cover the report middleware, salary class system,
  penalty helpers, BV/event/reception reports, and the workflow transition
  service (see the per-row file names; total count in
  `PATCH3_FINAL_IMPLEMENTATION_REPORT.md` §Tests).
- Rows marked **VERIFIED BY CODE INSPECTION** were read in source this stage.
- Rows marked **NOT EXECUTED** require an interactive per-role login and are
  carried into `PATCH3_UAT_SIGNOFF_MATRIX.md` — they are **not** reported as PASS.
