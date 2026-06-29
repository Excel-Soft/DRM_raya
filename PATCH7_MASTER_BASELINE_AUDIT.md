# PATCH 7 — MASTER BASELINE AUDIT

**Stage:** Patch 7 — Stage 0 (Master Baseline, Evidence Matrix, Closure Control)
**Scope:** AUDIT + DOCUMENTATION ONLY. No fixes, no refactor, no file deletion, no
destructive DB operations, no mock/fallback data added. No requirement marked
complete without evidence.
**Date captured:** 2026-06-29
**Codebase:** WebExcels DRM — React+Vite (`client/`), Express+TS (`server/`),
Drizzle ORM, PostgreSQL schema `drm`, JWT auth. Active runtime entry `server/index.ts`.

> Patch 7 consolidates all remaining open work across Patch 1–6 and is the current
> master closeout tracker. This document is the evidence-anchored baseline; the
> per-requirement status lives in `PATCH7_TRACEABILITY_MATRIX.md`.

---

## 1. App run status
- **PASS.** `npm run dev` (workflow "Start application") boots on port 5000.
- Live HTTP probes (this session): `GET /` → **200**; anon `GET /api/auth/me` / `/api/customers` / `/api/invoices` → **401**; anon `/api/support`, `/api/support/tickets` → **404** (deactivated).
- No boot-blocker fixes were required (app already runs); none were made.

## 2. npm check status
- **PASS — exit 0.** `npm run check` (`tsc`) completes with **0 errors**.
- Log: `/tmp/p7_check.log`.
- Note: an older memory note referenced pre-existing `tsc` errors; the current
  `check` script is clean at exit 0 as captured this session.

## 3. npm build status
- **PASS — exit 0.** `npm run build` completes in ~28.6s.
- Output: `dist/index.js` ≈ **2.3 MB** (server bundle). Client bundle emits a
  Rollup advisory: chunk(s) > 500 kB (code-splitting recommendation only — **not**
  an error). Log: `/tmp/p7_build.log`.

## 4. Database status
- **Reachable, read-only verification only.** Schema `drm` present.
- `information_schema`: **528 base tables + 1 view** (table count grows at runtime
  as per-executive sales tables are auto-provisioned via runtime ensure DDL).
- Key tables confirmed present: `users`, `invoices`, `projects`,
  `gm_partial_receipts`, `gm_loan_terms`, `social_media_posts`, `support_tickets`,
  `account_heads`, `office_expenses`, `activity_logs`,
  `cross_department_status_history`.
- **No `audit_logs` table** — audit writes go to `drm.activity_logs` (see §8/§AUD).
- `users.id` = **uuid**, `role` = text, `role_id` = text.
- **`npm run db:push` is known-broken** repo-wide (pre-existing FK type mismatch
  varchar→uuid). Schema is applied at runtime via `ensureDbOnce()`
  (`server/index.ts:76`) and `server/db/ensure.ts` (`CREATE TABLE IF NOT EXISTS` /
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). No destructive DB command was run.

## 5. Environment variables required
| Var | Required | Behavior |
|---|---|---|
| `DATABASE_URL` | Yes | DB connection (`drizzle.config.ts`). |
| `JWT_SECRET` | Yes (prod) | Validated at boot by `assertSecretsOrExit()` (`server/index.ts:16`); in production a missing / known-weak / `< 32` char secret **exits the process** (`server/config/validate-secrets.ts`). |
| `NODE_ENV` | Yes | Gates production-only guards. |
| `PORT` | Optional | Defaults to 5000. |
| `MOCK_AUTH` | Optional (dev only) | `true` bypasses JWT (header/env mock user). **FATAL** if set with `NODE_ENV=production` (`server/routes.ts:109-115`). |
| `MOCK_AUTH_EMAIL` | Optional (dev) | Mock user identity when `MOCK_AUTH=true`. |
| `IP_RESTRICTION_ENABLED` | Optional | Enables `checkAllowedIp`. |
| `VITE_DEMO_MODE_ENABLED` | Optional (client) | Must be `"true"` to show demo content; defaults OFF. |

## 6. Routes mounted before auth
The global JWT guard is `app.use("/api", authMiddleware)` at **`server/routes.ts:220`**,
applied only when `MOCK_AUTH !== "true"`. Mounted **before** it:
- `app.use("/api/support", …)` (**:100**) — Support deactivation guard (returns 404; see SUP-001).
- MOCK_AUTH dev middleware `app.use("/api", …)` (**:121**) — only when `MOCK_AUTH=true` (dev).
- `app.use("/api/drm", drmRoutes)` (**:156**) — **mounted before the global guard, but
  applies `authMiddleware` locally on every route** (e.g. `/permissions`,
  `/delay-projects`), and mutations require `requireActionPermission("drm.permissions.manage", { roles:["admin"] })`. By design (documented in `drm-routes.ts` header). **Not anonymous.**
- `app.use("/api/auth", authRoutes)` (**:159**) — public (login/register).
- `GET /health/db`, `GET /api/health/db` (**:176-177**) — public DB health.
- `GET /health/auth`, `GET /api/health/auth` (**:215-216**) — public token introspection (returns 401 when no/invalid token; does not grant access).

After the guard: `/api/me/*`, IP guard (`checkAllowedIp` :264), URL-permission guard
(`checkUrlPermission` :267), `attributesRoutes` (:272), and all business routers.
**Baseline finding:** no business route is anonymous; `/api/drm` is the only
business router mounted pre-guard and it self-guards per-route (verify in Stage 1
that every `drm` route retains its local `authMiddleware`).

## 7. Attributes / configuration route exposure
- `app.use("/api", attributesRoutes)` at **`server/routes.ts:272`** — **after** global
  auth (:220), IP guard (:264) and URL-permission guard (:267).
- Each endpoint additionally guarded by `requireActionPermission`: **view =
  authenticated**; **create / delete = admin / super_hod**, audited.
- Cross-role JWT matrix (executed in the immediately-prior same-code session and
  reused as P6-LIVE; see §24) confirms `attributes.create` / `attributes.delete`
  allowed only for admin + super_hod; other roles → 403.

## 8. JWT / MOCK_AUTH / secret validation status
- JWT auth via `authMiddleware`; role normalized through `normalizeRole`
  (`server/utils/role-utils.ts`).
- `validateSecrets()` + `assertSecretsOrExit()` (`server/config/validate-secrets.ts`,
  called `server/index.ts:16`): rejects missing, known-weak/placeholder, or `<32`
  char `JWT_SECRET` and **exits in production**.
- `MOCK_AUTH=true` + `NODE_ENV=production` → **FATAL refuse-to-start**
  (`server/routes.ts:109-115`).
- **Baseline finding:** secret hardening is code-complete; production-env UAT
  (boot with weak/missing secret in a prod build) is PENDING evidence (SEC-002).

## 9. Action-level RBAC gaps
- Action/role permission guards (`requireActionPermission`,
  `requireGmSalesActionPermission`, `requireFinancialPermission`,
  `requireReportPermission`, `requireRole`) used across **24 server files**.
- Verified by a cross-role JWT matrix executed in the immediately-prior same-code
  session (reused as P6-LIVE): `gm.create` allowed only for admin + super_hod +
  sales_executive (service_executive denied → Service-GM OFF); attribute
  create/delete admin/super_hod only.
- **Gap:** a full per-endpoint RBAC census proving 100% coverage of every sensitive
  mutation has **not** been completed (SEC-003). INV-001 (§13) is a concrete gap.

## 10. Raw `req.body` insert/update locations
- Naive persistence pattern `.values(req.body)` / `.set(req.body)`: **0 occurrences**.
- zod is used in **69 server files** (`safeParse` / `.parse`) for DTO validation.
- **Baseline finding:** direct raw-body persistence via the drizzle pattern is
  effectively eliminated; a full per-write-endpoint schema census is still
  recommended to close VAL-001 (some handlers may destructure body fields without a
  shared schema).

## 11. Direct frontend fetch locations
- **154** client files use the `apiRequest` wrapper (`client/src/lib/queryClient.ts`).
- **34** client files still call raw `fetch(` directly (mixed: some legitimate
  downloads/streams, some bypass the wrapper's auth/error handling) → API-001 Partial.

## 12. Dynamic SQL / `sql.raw` / unsafe LIMIT/OFFSET locations
- `sql.raw` / `sql.unsafe`: **4 occurrences across 3 repositories** —
  `server/repositories/project-financials.repository.ts`,
  `server/repositories/tasks.repository.ts`,
  `server/repositories/projects.repository.ts`.
- Parameterized (`$1`) queries are the prevailing pattern elsewhere.
- **Baseline finding:** the 4 `sql.raw` sites must be inspected for identifier
  safety / injection vectors (SQL-001 Partial). No evidence yet that any is exploitable.

## 13. Invoice status update risk locations
- `server/account-routes.ts` exposes an invoice status path with a permissive
  schema (`status: z.string().optional()` region). Patch 3/6 flagged a **raw status
  update** that does not route through the central invoice state machine / audit.
- **Status: OPEN (INV-001)** — highest-priority carry-over. Must be routed through
  `invoice-workflow.service.ts` (state machine + audit) in Sprint 2.

## 14. Invoice-to-project linking behavior
- `createOrLinkProjectForApprovedInvoice` creates/links a project on invoice
  approval; idempotency backed by unique constraint `uq_projects_invoice_root`
  (one project per approved invoice root). Best-effort link path.
- Approval readiness enforced by `assertApprovalReadiness` + `findActiveDuplicate`.
- Code-complete + AUTO tests; **browser UAT pending** (INV-002 / INV-003).

## 15. GM creation routes and guards
- `POST /api/gm` (`server/gm-pool-routes.ts`) guarded by
  `requireGmSalesActionPermission`. `gm.create` allowed: admin, super_hod,
  sales_executive; **service_executive denied by default (Service-GM OFF)**.
- Threshold hook `validateMinimumPaymentThreshold`; finalize gate
  `enforceLoanPartialFinalApprovalGate` → `PARTIAL_PAYMENT_INCOMPLETE`.
- Role allow/deny is **management-confirmation dependent** (service-exec, thresholds).

## 16. Full / Partial / Loan GM current state
- Type routing via `resolveCanonicalGmType` (Full / Partial / Loan).
- Partial: `drm.gm_partial_receipts` tracks receipts; finalization blocked until
  fully paid (all-paid gate).
- Loan: `drm.gm_loan_terms.admin_approval_status` must be `APPROVED` or finalize
  → **409** (`account-routes.ts` L149-160). Code-complete + AUTO tests; thresholds,
  invoice timing, and service-exec participation are **management-pending**.

## 17. Service bridge route behavior
- `server/service-core-routes.ts` handles followup / complaint / dropout / renewal
  with **rich audit logging**. Service → GM/VAS/BV bridge actions exist but
  **Service-GM creation is OFF by default** pending management decision (SRV-001).

## 18. Support sidebar / route / API visibility
- Support is **deactivated/out-of-scope by default**: `app.use("/api/support", …)`
  short-circuit at `server/routes.ts:100` (returns 404); sidebar/route visibility
  gated off. `drm.support_tickets` table still exists. Final deactivate-vs-retain
  decision is **management-pending** (SUP-001).

## 19. Social Media persistence status
- **Internal / manual only — no external provider integration** (explicitly
  documented in `server/social-media-routes.ts` L19-21). Posts persist to
  `drm.social_media_posts` with server-enforced `approval_status`
  (DRAFT→PENDING→APPROVED/REJECTED) and `publishing_status`
  (DRAFT→READY→SCHEDULED→PUBLISHED) state machines. "Publish" records an internal
  manually-confirmed publication; it never claims a push to an external platform.
- External publishing scope is **management-pending** (SOC-EXT-001).

## 20. Office Accounts submodule status
- Active: Chart of Accounts (`/office/chart-of-accounts`, real `drm.account_heads`),
  Trial Balance, General Ledger, Office Expenses — backed by
  `server/office-account-routes.ts` with audit logging.
- Legacy `office-account-head.tsx` / `office-old-account-head.tsx` **redirect** to
  Chart of Accounts (`client/src/App.tsx:331,335`); files retained on disk
  (no-delete policy) and still contain mock/stub content (ACC-LEGACY-001).
- Report ownership (Reports vs Accounts Office), VAS source, and retained-vs-removed
  submodules are **management-pending** (OFF-005, REP-001, item 13).

## 21. Domain / Server Names status
- `server/it-assets-routes.ts` manages domains and servers with audit logging;
  client `it-servers.tsx` and IT pages consume them. Code-complete; some UI states
  and the `it-manager-dashboard.tsx` mock data remain (DOM-002 / UI-001).

## 22. Report signoff gaps
- Export parity captured (`PATCH6_REPORT_EXPORT_PARITY_RESULTS.md`).
- **Formula sign-off PENDING** (`PATCH6_REPORT_FORMULA_SIGNOFF_PENDING.md`): BV
  metric formulas, salary formula/freeze, attendance/day-target rules, and report
  ownership all require management confirmation (REP-001..005).

## 23. Patch 5 evidence gap
- Patch 5 **has substantial evidence** (not a void): requirements **P1–P14**
  (`PATCH5_BASELINE_AUDIT.md`), `PATCH5_ISSUE_MATRIX.md` mapping each req→code,
  `PATCH5_FINAL_IMPLEMENTATION_REPORT.md`, `PATCH5_AUDIT_VERIFICATION.md`,
  `PATCH5_DATA_INTEGRITY_QA.md`, `PATCH5_PERMISSION_QA_MATRIX.md`,
  `PATCH5_QA_CHECKLIST.md`, 7 stage changelogs, and an automated suite
  `server/patch5-stage7-role-matrix.test.ts` (**180 tests**).
- Evidence type is **AUTO (API tests) + CODE (inspection)**. **GAP:** full
  **role-based browser UAT** is flagged MANUAL-PENDING, there are no raw code-diff
  artifacts (only structured changelogs), and **7 management confirmations remain
  PENDING (defaults)** (`PATCH5_MANAGEMENT_CONFIRMATION_STATUS.md`).
- **Conclusion (P5-001): PARTIAL** — code + automated-test evidenced; browser UAT
  proof and management confirmations outstanding. Patch 5 is **not yet conclusively
  signed off** but is **not** unverified.

## 24. Build / UAT / governance gaps
- Technical gates PASS: check 0, build 0, **`npm test` 219/219 (14 files)**.
- **UAT gap:** anonymous 401 sweep (this session: `/api/customers`,`/api/invoices`→401,
  `/api/support`→404; plus the reused prior same-code-session 16-endpoint sweep) +
  cross-role JWT **API** matrix (reused from the prior same-code session, P6-LIVE)
  are executed; full **role-based browser UI UAT is PENDING** (UAT-004).
- **Governance gap:** 15 management confirmations outstanding
  (`PATCH7_MANAGEMENT_CONFIRMATION_REQUIRED.md`).
- **Production residuals (PROD-001):** npm-audit vulnerabilities (transitive),
  client bundle size advisory, and full prod-env boot drills pending. Guards
  (MOCK_AUTH-fatal, JWT fail-fast, demo OFF) are in place.

---

### Top P0 risks (confirmed)
1. **INV-001** — raw invoice status update bypasses the state machine / audit (OPEN).
2. **UAT-004 / P5-001** — no executed role-based **browser** UAT proof (API-level only).
3. **GM business rules (GM-003/008/009, SRV-001, SUP-001)** — blocked on management
   confirmation; defaults are in force, not signed-off policy.
4. **SEC-003 / VAL-001 / SQL-001** — coverage is broad but not proven 100%; 4
   `sql.raw` sites and 34 raw client `fetch` calls remain to be censused.
5. **DB-001** — `db:push` broken; schema relies on runtime ensure DDL (no destructive
   migration path).
