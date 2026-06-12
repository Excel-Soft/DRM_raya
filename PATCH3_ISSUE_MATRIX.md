# PATCH 3 — Issue Matrix

Companion to `PATCH3_BASELINE_AUDIT.md`. Read-only inventory; **no code changed**.

**Status legend:**
- `OPEN` — confirmed gap, fix in the indicated stage.
- `VERIFIED-OK` — inspected; no gap in current code (do not "fix").
- `MITIGATED` — handled, with a hardening/clean-up note.
- `VERIFY` — works, but needs functional/definition validation in a later stage.

Line numbers are as of 2026-06-12 and may drift; treat the file + symbol as the anchor.

| Issue ID | Priority | Module | Route / API | Frontend file | Backend file | DB source / table | Current gap | Implementation target | Stage | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | P0 | Routing/Auth | `/api/drm` mounted before global auth | — | `server/routes.ts:139`, `server/drm-routes.ts:14-55` | `drm.menu_permissions` | Mounted before `authMiddleware` (:206) **but** auth+admin RBAC applied locally per route | None — verified safe; keep local guards if route list grows | 1 | VERIFIED-OK |
| SEC-002 | P0 | Auth/secrets | `/api/auth/me`, `/api/users*` | — | `server/auth.routes.ts:193-202`, `server/users-routes.ts:178,316` | `drm.users` | Password/hash exposure risk | Already sanitized everywhere; no exposure | 1 | VERIFIED-OK |
| SEC-003 | P0 | Auth | `/api/auth/forgot-password`, `/reset-password-with-token` | `pages/auth.tsx` | `server/auth.routes.ts:312-388` | reset-token (hashed) | Token/enumeration/replay risk | SHA-256 token, one-time, generic msg, rate-limited | 1 | VERIFIED-OK |
| SEC-004 | P0 | Auth config | `MOCK_AUTH` bypass | — | `server/routes.ts:92-136` | — | Auth bypass branch present in routes | Prod-guarded (throws); config-hygiene clean-up only | 5 | MITIGATED |
| SEC-005 | P0 | Routing | attributes routes before global auth | — | `server/routes.ts:145` | — | `app.use("/api", attributesRoutes)` before `authMiddleware` — confirm intended-public per handler | Audit each handler; gate if not meant public | 1 | OPEN |
| SEC-006 | P0 | Secrets | JWT signing | — | `.replit:54`, `server/auth.service.ts:6,23,28` | — | **Hardcoded `JWT_SECRET` committed to source** (`.replit`); violates replit.md. Value not reproduced. | Move to Replit-managed secret + **rotate** (user-approved; invalidates sessions) | 1 | OPEN |
| AUTH-001 | P0 | RBAC (FE) | route protection | `client/src/hooks/useRouteProtection.ts:79` | — | server permission check | Fail-open URL permission risk | Fail-**closed** (`if (!ready) return`) confirmed | 1 | VERIFIED-OK |
| AUTH-002 | P0 | RBAC (FE) | sidebar visibility | `client/src/components/app-sidebar.tsx:385-460` | — | `drm.menu_permissions` / roles | Fail-open sidebar risk | Final fallback `return false` (hide) confirmed | 1 | VERIFIED-OK |
| RBAC-001 | P0 | RBAC (BE) | action permission middleware | — | `server/middleware/action-permission.ts`, `middleware/rbac.middleware.ts` | roles/permissions | Are mutations action-gated? | Present and used by workflow/HOD/drm routes | 1 | VERIFIED-OK |
| INV-001 | P0 | Invoices | `PATCH /api/account/invoices/:id/status` | `pages/invoice-report.tsx`, `components/InvoiceCreateForm.tsx` | `server/account-routes.ts:1106-1122` | `drm.invoices` | **No state machine** on `drm.invoices` — any status accepted, no from→to validation. (A full machine already exists for the *other* table `drm.product_posting_invoices`.) | Add transition validator for `drm.invoices`, **reusing** `server/services/invoice-workflow.service.ts` — do not duplicate | 1 | OPEN |
| INV-002 | P0 | Invoices | `POST/PATCH /api/account/invoices(/:id)` | `components/InvoiceCreateForm.tsx` | `server/account-routes.ts:1048-1103` | `drm.invoices` | Create uses zod; update uses `pickWritable` allow-list (good) | None — pattern to reuse elsewhere | 1 | VERIFIED-OK |
| INV-003 | P0 | Invoices | `/api/invoices` (product-posting) | product-posting pages | `server/services/invoice-workflow.service.ts`, `server/routes.ts:356` | `drm.product_posting_invoices` | Existing state machine (DRAFT→PENDING_HOD→PENDING_ACCOUNT→APPROVED→PAID) | None — reuse as the template for INV-001 | 1 | VERIFIED-OK |
| WF-001 | P0 | Product-posting workflow | transition endpoints | `pages/product-posting-dashboard.tsx` | `server/routes/product-posting-workflow-routes.ts`, `server/services/workflow-transition.service.ts:92-355` | posting workflow tables | Transition/state validation | Centralized `assertWorkflowTransition` (legal states + mandatory fields) confirmed | 4 | VERIFIED-OK |
| WF-002 | P0 | Software workflow | transition endpoints | software pages | `server/routes/software-workflow-routes.ts` + transition service | software workflow tables | Same as WF-001 | Uses the same centralized state machine | 4 | VERIFIED-OK |
| WF-003 | P0 | Service workflow | `POST /api/service/gm|vas|bv` | service pages | `server/service-core-routes.ts:451-459` | (none) | Bridges return **501** — not implemented | Implement real linkage or formally defer | 2 | OPEN |
| WF-004 | P1 | PMS workflow | PMS task/project create/update | `pages/pms-*.tsx` | `server/pms-routes.ts` | `drm` PMS tables | Create routes **are** zod-validated (`insert*Schema.parse`), so not unguarded mass-assignment; real gap is thin status-transition rules + confirming schemas don't expose privileged columns | Add transition checks; audit insert schemas | 6 | OPEN |
| APR-001 | P0 | Approvals | invoice status / ledger | `pages/invoice-report.tsx` | `server/account-routes.ts:1106-1108` | `drm.invoices` | Action only checks `if(!req.user)` — no role/action gate | Add action-level role gate | 1 | OPEN |
| APR-002 | P0 | Approvals | HOD/PMS approvals | `pages/hod-dashboard.tsx`, pms pages | `server/hod-routes.ts:17,260`, `repositories/project-approvals.repository.ts:169` | approvals tables | Action-level gating present (`requireHod`, `requireRole`) | None — verified | 1 | VERIFIED-OK |
| APR-003 | P1 | Approval visibility | approval lists | `pages/hod-dashboard.tsx` | `server/hod-routes.ts` | approvals | Visibility/scope correctness | Validate scope in later stage | 6 | VERIFY |
| XDL-001 | P0 | Cross-dept | Sales→Accounts (GM→Project) | — | `server/account-routes.ts:550` (`create-project-from-gm`) | `drm.gm_entries`→projects | Linkage exists (on GM approval) | Verified present; confirm coverage | 2 | VERIFY |
| XDL-002 | P0 | Cross-dept | Accounts/Sales→Service | service pages | `server/service-core-routes.ts:447-459` | — | Service bridges missing (501) | Implement or defer (with WF-003) | 2 | OPEN |
| XDL-003 | P1 | Cross-dept | status linking across depts | various | `server/account-routes.ts:232` (UNION/COALESCE views) | multiple | Sync is view-level only; can drift if status strings differ | Active sync where report requires | 2 | OPEN |
| PEN-001 | P0 | Penalty | `POST /api/penalties`, `GET /api/penalties` | `pages/drm/add-penalty.tsx`, `pages/service-add-penalty.tsx` | `server/penalty-routes.ts:200`, `server/services/penalty.service.ts` | `drm.penalties` | Persistence (was suspected fake) | Real INSERT + list read confirmed; uses `apiRequest` | 3 | VERIFIED-OK |
| PEN-002 | P1 | Penalty | `PUT /api/penalties/:id` | penalty pages | `server/penalty-routes.ts:~354` | `drm.penalties` | Update object built from `req.body` keys without strict zod schema | Add zod allow-list to update | 3 | OPEN |
| PEN-003 | P1 | Penalty | authz for create/decide/void/report | penalty pages | `server/penalty-routes.ts:45-72` vs `server/middleware/report-permission.ts` | roles | `penalty_report` entry in report-permission.ts is **dead config** that diverges from the route-local `canCreate/canDecide/canVoid/canViewReports` | Reconcile/remove dead config | 3 | OPEN |
| RPT-RAW-001 | P0 | Raw attendance | `GET /api/reports/raw-attendance` | `pages/reports-raw-attendance.tsx` | `server/stage3-reports-routes.ts` | `drm.attendance`⋈`drm.users` | Data source correctness | Real data, FE/BE matched | 4 | VERIFIED-OK |
| RPT-RAW-002 | P1 | Raw attendance | `GET /api/reports/raw-attendance/export` | `pages/reports-raw-attendance.tsx` | `server/stage3-reports-routes.ts` | same | Export scope/permission parity | Export re-applies filters+scope; raw SQL `LIMIT/OFFSET ${}` (GLOBAL-002) | 4/5 | VERIFY |
| SAL-CREATE-001 | P0 | Salary | `/api/salary/preview`,`/runs`,`/runs/:id/status`,`/export` | `pages/salary-create.tsx` | `server/salary-routes.ts` | `drm.salary_runs`,`drm.salary_run_items` | Data + authz correctness | Real data; authz via salary **class system** (not report middleware) | 4 | VERIFIED-OK |
| SAL-REPORT-001 | P0 | Salary | `GET /api/reports/salary` | `pages/salary-report.tsx` | `server/salary-routes.ts` | `drm.salary_run_items` | Data + scope | Real data; class-system authz; `salary_create/salary_report` entries in report-permission.ts are dead config | 4 | VERIFIED-OK (note dead config) |
| EDIT-ATT-001 | P0 | Edit attendance | `GET/POST /api/attendance/edits` | `pages/reports-edit-att.tsx` | `server/attendance-edit-routes.ts` | `drm.attendance_edit_requests` | Data + flow | Real data; reject uses `window.prompt` (UX note, not data gap) | 4 | VERIFIED-OK |
| DAY-TARGET-001 | P0 | Day target | `GET /api/reports/day-target` | `pages/reports-day-target.tsx` | `server/reports-routes.ts` (`getDayTargetReport`) | `drm.targets`+`gm_entries`+`user_activities` | Was a 501 stub | Now real (fixed prior stage) | 4 | VERIFIED-OK |
| DAY-TARGET-002 | P1 | Day target | `/api/reports/day-target/export` | `pages/reports-day-target.tsx` | `server/reports-routes.ts` | same | Export parity + metric definitions | Validate metric math + export scope | 4 | VERIFY |
| DIAG-001 | P0 | Diagnosis | `GET /api/reports/diagnose` | `pages/reports-diagnose.tsx` | `server/diagnosis-report-routes.ts` | `drm.diagnosis_reports` | Suspected data-source mismatch (BV reuse) | **No mismatch** — own table; explicitly not BV data | 4 | VERIFIED-OK |
| DIAG-002 | P1 | Diagnosis | diagnose access scope | `pages/reports-diagnose.tsx` | `server/diagnosis-report-routes.ts:38-49` (`accessLevel`) | `drm.diagnosis_reports` | Scope: all authenticated roles can view (own/team/all); export restricted | Confirm intended scope with business | 4 | VERIFY |
| BV-001 | P0 | BV report | `GET /api/reports/bv` | `pages/bv-report-new.tsx`,`pages/user-reports.tsx` | `server/reports-routes.ts`, `server/services/bv-report.service.ts` | `drm.bv_reports`+`drm.gm_entries` | Data-source mismatch | Real; computed from `gm_entries`+`bv_reports` | 4 | VERIFIED-OK |
| BV-002 | P0 | BV report | metrics definitions | `pages/bv-report-new.tsx` | `server/services/bv-report.service.ts` | `drm.gm_entries` | Metrics mismatch (totals/value) | Not hardcoded; **validate metric definitions** vs business | 4 | VERIFY |
| BV-003 | P1 | BV report | `GET/POST /api/bv-reports` + approve | `pages/user-reports.tsx` | `server/reports-routes.ts` | `drm.bv_reports` | CRUD/approve authz | `requireReportPermission("bv_report",...)` (admin/super_hod/account_manager/hod) | 4 | VERIFIED-OK |
| BV-004 | P1 | BV report | `id` type joins | — | `server/reports-routes.ts` | `gm_entries`(varchar) vs `customers.id`(uuid) | Raw SQL joins/UNIONs need `::text` casts or 500 | Keep casts when editing BV SQL | 4 | VERIFY |
| GLOBAL-001 | P1 | Frontend | raw `fetch("/api/...")` | ~40 pages incl. `salary-*`,`reports-*`,`auth.tsx`,`office-expenses.tsx`,`cheque-system.tsx`,`quotation.tsx`,`InvoiceCreateForm.tsx`,`lead-import-dialog.tsx` | `client/src/lib/queryClient.ts` (helpers) | — | Bypass shared `apiRequest`/`getQueryFn` (consistency/auth/error handling) | Migrate to shared helper incrementally | 5 | OPEN |
| GLOBAL-002 | P1 | Backend | raw SQL interpolation | — | `server/quick-entries-routes.ts:122,239,325,407`, `server/stage3-reports-routes.ts:263,305,503` | various | `LIMIT/OFFSET ${}` + `${where}` text interpolation (numeric/server-controlled; structural risk) | Parameterize / hard-cast; whitelist fragments | 5 | OPEN |
| GLOBAL-003 | P0 | Backend | mass-assignment (raw `...req.body`) | service/notice pages | `service-core-routes.ts:74,148,398`, `notice-routes.ts:82` | service tables, `drm.notices` | **Genuine** raw spread into insert/`.set()` (no zod). Other cited sites (pms/overtime/loan/posting/temp-contacts/notice-create) are zod-parsed → not unguarded (residual: schemas may expose privileged cols) | Allow-list the 4 raw sites; audit insert schemas | 1 | OPEN |

## Coverage of required IDs

SEC-001..006, AUTH-001/002, RBAC-001 (auth/RBAC) · INV-001/002/003 · WF-001..004 ·
APR-001..003 · XDL-001..003 · PEN-001..003 · RPT-RAW-001/002 ·
SAL-CREATE-001/SAL-REPORT-001 · EDIT-ATT-001 · DAY-TARGET-001/002 ·
DIAG-001/002 · BV-001..004 · GLOBAL-001..003. ✅ All required minimum IDs present.

## Stage roll-up (from §15 of the baseline)

- **Stage 1 (security/RBAC/invoices):** SEC-006 (rotate+move JWT_SECRET), INV-001
  (reuse `invoice-workflow.service.ts`; INV-003 is the template), APR-001,
  GLOBAL-003 (4 genuine raw sites), SEC-005
- **Stage 2 (cross-dept/service bridges):** WF-003, XDL-002, XDL-003, XDL-001(verify)
- **Stage 3 (penalty hardening):** PEN-002, PEN-003
- **Stage 4 (report finishing/validation):** BV-002, DIAG-002, DAY-TARGET-002, BV-004, RPT-RAW-002
- **Stage 5 (global hygiene):** GLOBAL-001, GLOBAL-002, SEC-004
- **Stages 6-7 (P1 modules + P2 UI/UX + UAT):** WF-004 (PMS transition rules),
  APR-003, remaining P1/P2 from the report
