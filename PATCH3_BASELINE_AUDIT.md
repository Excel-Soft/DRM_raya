# PATCH 3 — STAGE 0: Baseline Audit & Scope Control

**Date:** 2026-06-12
**Scope:** Inspection only. No business logic changed, no refactors, no deletes,
no workflow changes, no destructive DB commands, no mock data added, no secrets
touched. This document records the *current* state of the active app
(`server/`, `client/`, `shared/`) against the Patch 3 combined issue report.

> Method note: findings below were produced by reading the actual route/page
> files. Two initial automated claims were **corrected after direct inspection**
> (the `/api/drm` mount-order "fail-open" and a mis-located mass-assignment line);
> the corrected facts are recorded here.

---

## 1. App run status

- **Runtime:** Node `v20.20.0`, npm `10.8.2`.
- **Primary command:** `npm run dev` (`cross-env NODE_ENV=development tsx watch
  server/index.ts`), port **5000**. The `Start application` workflow is **running**.
- `server/index.ts` serves both the API and the Vite client via middleware (single
  origin). `setupVite` in dev, `serveStatic` in prod.
- Legacy scripts `auth:dev` (`src/server/index.ts`) and `api:dev` (`src/server.ts`)
  point at the smaller `src/` scaffold and are **not** the active app — excluded
  from scope per the brief.
- **Result:** app boots and serves; no boot fix was required.

## 2. Database status

- **Engine:** PostgreSQL (Replit-provided), Drizzle ORM, schema name **`drm`**.
  `DATABASE_URL` is present in the Replit-managed environment (value not printed).
- **Health probe:** `GET /api/health/db` → `{"ok":true,"db":"up"}` at audit time.
- Schema lives in `shared/schema.ts`; runtime ensure/migration helpers exist under
  `server/migrations/` and `migrations/`.
- **Known infra issue (pre-existing, out of scope):** `npm run db:push`
  (`drizzle-kit push`) fails repo-wide on a pre-existing FK type mismatch. Schema
  deltas in this repo are applied via runtime `ALTER TABLE ... ADD COLUMN IF NOT
  EXISTS` / SQL, not `push`. Do **not** rely on `db:push` for Patch 3.

## 3. npm check / build status

- **`npm run check`** = `tsc` (no emit). Result: **56 errors**. These are the
  **pre-existing baseline** (unchanged from prior patches) and are unrelated to
  Patch 3 work. They cluster in:
  - `server/reports-routes.ts` (Drizzle enum/`inArray` typing, nullable `string`,
    `refund_gm_entries.createdBy` not on the table type),
  - `server/repositories/*.ts` (`call-sessions`, `customers`, `permissions`,
    `project-approvals`, `project-assignments` — nullable vs non-null `name`,
    extra keys),
  - `server/migrations/update-related-customers.ts` (`Cannot find module './db'`).
  - Per the brief, these are **documented, not fixed** (no refactor of unrelated code).
- **`npm run build`** = `vite build && esbuild server/index.ts ...`. Not changed
  this stage; it succeeded in the immediately prior session and no source touched
  here affects it.
- **Tests:** `npm test` (`vitest run`) baseline = 125 passing / 8 files (prior run).

## 4. Confirmed P0 risks

| # | Area | Finding | Evidence |
|---|---|---|---|
| P0-1 | **Invoice state machine (`drm.invoices`)** | `PATCH /api/account/invoices/:id/status` accepts **any** status string; **no allowed from→to transition validation** (only "Paid" auto-sets `paidAt`). NB: a full invoice state machine **already exists** for the *other* invoice table `drm.product_posting_invoices` (`server/services/invoice-workflow.service.ts`, `INVOICE_STATE_MACHINE.md`, mounted at `/api/invoices`) — reuse it as the template; the gap is only on `drm.invoices`. | `server/account-routes.ts:1106-1122` |
| P0-2 | **Action-level approval gating (invoices)** | Same endpoint only checks `if (!req.user)` — **no role/action permission**. Any authenticated user can change `drm.invoices` status. Ledger entries similarly thin. | `server/account-routes.ts:1106-1108` |
| P0-3 | **Cross-department service bridges** | `POST /api/service/gm` `/vas` `/bv` return **501 Not Implemented** (honest failure, not fake). Sales/Accounts→Service linkage is incomplete. | `server/service-core-routes.ts:451-459` |
| P0-4 | **Mass-assignment (raw `...req.body`)** | **Genuine raw spreads** (no allow-list, no zod): `db.insert(...).values({...req.body})` for service followups/complaints/renewals, and a `.set({...req.body})` notice update. Most other writers that spread `...req.body` (all pms creates, overtime, loan, posting, temp-contacts, notice **create**) feed it into `insert*Schema.parse()/safeParse()` first, so unknown keys are stripped — those are **not** unguarded (residual risk only if the insert schema itself exposes privileged columns like status/approver). | raw: `service-core-routes.ts:74,148,398`, `notice-routes.ts:82` |
| P0-5 | **Committed `JWT_SECRET` in source** | `.replit` (line 54) contains a hardcoded `JWT_SECRET` committed to the repo; `server/auth.service.ts` signs/verifies JWTs with it. Violates `replit.md` ("Secrets must live in Replit-managed env, never hard-coded"). Remediation = move to a Replit-managed secret **and rotate** (rotation invalidates existing sessions → user-approved). Value not reproduced here. | `.replit:54`, `server/auth.service.ts:6,23,28` |

**P0 items inspected and found NOT to be a vulnerability (verified, no action needed):**

- **`/api/drm` mounted before global auth (routes.ts:139, authMiddleware at :206)
  is SAFE.** `server/drm-routes.ts` applies `authMiddleware` **locally on every
  route** (`:23,:34,:55,...`) and `requireActionPermission("drm.permissions.manage",
  {roles:["admin"]})` for every mutation (`:14-20`). The before-auth mount is
  intentional and documented in-file; it is not fail-open.
- **No password / hash / reset-token exposure.** `GET /api/auth/me`,
  `GET /api/users`, `GET /api/users/:id`, `POST /api/users` all return sanitized
  objects (explicit "never expose password_hash" guard). Password reset stores only
  a SHA-256 hash of a random token, one-time-use, generic response, rate-limited.
- **Frontend gating is fail-CLOSED.** `useRouteProtection.ts` returns early until
  the authoritative server check resolves (`if (!ready) return; // never fail-open`);
  `app-sidebar.tsx hasAccess()` final fallback is `return false` (hide).
- **`MOCK_AUTH` bypass** exists in `routes.ts` but is hard-guarded to throw in
  production; flagged as a config-hygiene item, not an active P0.

## 5. Confirmed P1 risks

| # | Area | Finding |
|---|---|---|
| P1-1 | Service GM/VAS/BV **report** endpoints are **stubs** | `GET /api/service/gm-report`, `/vas-report`, `/bv-report` return `{message:"... stub"}` placeholders (no data). `service-core-routes.ts:423-445`. |
| P1-2 | Cross-department **sync is view-level only** | Status "linking" across depts is mostly COALESCE/UNION SQL views (e.g. `account-routes.ts:232`) rather than active sync; UI can drift if status strings differ. |
| P1-3 | Penalty **update** validation | `PUT /api/penalties/:id` builds the update object from `req.body` keys without a strict zod schema (`penalty-routes.ts:~354`). Create path is fine. |
| P1-4 | Penalty **authorization is a separate system** | Penalty routes self-authorize via `canCreate/canDecide/canVoid/canViewReports`; the `penalty_report` entry in `report-permission.ts` is **dead config** that diverges from real behavior. (Same pattern as salary.) |
| P1-5 | Report/export consistency | Reports use 3 independent authz systems (report-permission middleware, salary class system, route-local helpers); documented but worth a consolidation pass. |

## 6. Confirmed mock / static pages

- **Server stubs (placeholder responses, not real data):**
  `GET /api/service/gm-report`, `/api/service/vas-report`, `/api/service/bv-report`
  → `{message:"... stub"}` (`server/service-core-routes.ts:423-445`).
- **Client deprecated/unrouted mocks (not on active Patch 3 routes; left as-is):**
  `client/src/pages/performance-graph.tsx` (sample series) and a `gm-report` city
  dropdown — confirmed in prior patch as not wired to live routes.
- **No mock data found on the routed report pages** (raw-attendance, salary, edit-att,
  day-target, diagnose, BV, event, reception) — all bind real endpoints (see §14).
- DRM static info pages (P1 in the report) exist as content pages — to be inventoried
  for completeness in a later stage; none fake data.

## 7. Confirmed "fake success" actions

- **None that fabricate data.** The Service→GM/VAS/BV **mutation** bridges
  deliberately return **501** instead of a fake success
  (`service-core-routes.ts:447-459`) — comment explicitly states they fail clearly
  so the UI cannot believe a record exists.
- Penalty create returns success only on a real `201` from a real INSERT into
  `drm.penalties` (`penalty.service.ts` / `penalty-routes.ts`) — not faked.
- Risk-adjacent (not fake success, but weak): invoice status PATCH returns the
  updated row with no transition/role checks (see P0-1/P0-2).

## 8. Confirmed missing endpoints

- `POST /api/service/gm`, `POST /api/service/vas`, `POST /api/service/bv` —
  **501 Not Implemented** (intentional placeholder; real linkage missing).
- Service GM/VAS/BV **report** GETs exist but are stubs (data not implemented).
- No other frontend call was found pointing at a non-existent backend path on the
  in-scope report pages (see §9).

## 9. Confirmed frontend/backend endpoint mismatches

- **None breaking** on the audited report pages — each client page calls a path that
  exists on the backend (verified per report in §14).
- **Naming nuance to note (not a break):** `reports-event.tsx` calls
  `GET /api/events/report` (real, reads `drm.events`); the older
  `GET /api/reports/event` is a legacy meeting-based feed and is **not** used by the
  page. Document so a later stage doesn't "fix" the wrong route.

## 10. Confirmed routes mounted before authentication

In `server/routes.ts`, registered **before** `app.use("/api", authMiddleware)` (:206):

- `/api/drm` (:139) — **safe**: enforces `authMiddleware` + admin RBAC *locally*
  per route (see §4).
- `/api/auth` (:142) — **public by design** (login/signup/forgot-password).
- `/api` attributes routes (:145) — review in a later stage to confirm each handler
  is intended public; currently mounted before global auth.
- `/health/db`, `/api/health/db`, `/health/auth`, `/api/health/auth` (:162-202) —
  **public by design** (health probes; auth-health only reports token validity).

All other `/api/*` routers are registered **after** `authMiddleware` and are protected.

## 11. Confirmed direct `/api` calls not using the shared auth helper

The shared helpers are `apiRequest` / `apiRequestJson` / `getQueryFn` in
`client/src/lib/queryClient.ts`. ~**40 client files** issue raw `fetch("/api/...")`
calls that bypass them (consistency / error-handling / auth-header risk). High-traffic
examples:

- `pages/salary-create.tsx`, `pages/salary-report.tsx`, `pages/reports-raw-attendance.tsx`,
  `pages/reports-day-target.tsx`, `pages/reports-diagnose.tsx`, `pages/reports-edit-att.tsx`,
  `pages/reports-event.tsx`, `pages/reports-reception.tsx`, `pages/user-reports.tsx`
- `pages/auth.tsx`, `pages/business-customers.tsx`, `pages/office-expenses.tsx`,
  `pages/cheque-system.tsx`, `pages/quotation.tsx`, `pages/invoice-report.tsx`,
  `pages/hod-dashboard.tsx`, `pages/dd-executive-dashboard.tsx`, `pages/gm-pool-add-gm.tsx`,
  `components/lead-import-dialog.tsx`, `components/InvoiceCreateForm.tsx`,
  `components/customer-monthly.tsx`, `components/target-achieve.tsx`, …
- (`pages/dollar-system.tsx.backup` is a backup file — left untouched per project rule.)

These mostly *do* send credentials, but they are not centralized — tracked as
**GLOBAL-001**.

## 12. Confirmed raw SQL interpolation

- **Low-risk numeric interpolation** (values are parsed to ints, but structurally
  interpolated): `LIMIT ${pageSize}/${limit} OFFSET ${offset}` in
  `server/quick-entries-routes.ts` (:122,:239,:325,:407) and
  `server/stage3-reports-routes.ts` (:263,:305,:503).
- **Dynamic WHERE fragment** interpolated as text in `quick-entries-routes.ts`
  (`${custWhere}` / `${where}` with params array) — verify the fragments are
  built only from server-controlled tokens, not raw user input.
- The bulk of `pool.query(...)` usage is **parameterized** (`$1,$2,...`) and Drizzle
  `sql\`...${value}\`` (which parameterizes). Tracked as **GLOBAL-002**.
- One-off maintenance scripts (`fix_permissions.*`, `add-prices-*.ts`, `check_*.ts`)
  use template SQL but are **not request-reachable**; flagged informationally only.

## 13. Confirmed broad body update risks

Re-verified line-by-line (the first automated pass over-reported this; corrected here).

**Genuine raw `...req.body` (no zod, no allow-list) — fix these:**
- `server/service-core-routes.ts` — `db.insert(...).values({...req.body})` for
  followups (`:74`), complaints (`:148`), renewals (`:398`).
- `server/notice-routes.ts:82` — `.update(notices).set({ ...req.body, updatedAt })`.

**NOT unguarded (spread is fed through `insert*Schema.parse()/safeParse()`, which
strips unknown keys) — do NOT churn these:**
- `server/pms-routes.ts` (cited create routes, e.g. `:438` →
  `insertProjectSchema.parse({...req.body, ...})`),
  `server/overtime-routes.ts:166` (`safeParse`), `server/loan-routes.ts:123`,
  `server/posting-data-routes.ts:81`, `server/temp-contacts-routes.ts:367`,
  `server/notice-routes.ts:55` (create).
  *Residual* risk: confirm these insert schemas don't themselves expose privileged
  columns (status / approver / owner) that a client shouldn't set.
- `server/penalty-routes.ts:~354` — update object is built from mapped `req.body`
  keys but **not** zod-validated (PEN-002).

**Contrast (good pattern to emulate):** invoice **update** uses `pickWritable` +
`INVOICE_WRITABLE_FIELDS` allow-list (`account-routes.ts:1079`); the product-posting
invoice flow uses `server/services/invoice-workflow.service.ts`. These are the
remediation templates.

## 14. Confirmed report data-source review

| Report | Client page | Backend route | DB source | Verdict |
|---|---|---|---|---|
| Raw attendance | `reports-raw-attendance.tsx` | `GET /api/reports/raw-attendance` (+`/export`) `stage3-reports-routes.ts` | `drm.attendance` ⋈ `drm.users` | **REAL — no mismatch** |
| Salary create | `salary-create.tsx` | `/api/salary/preview`,`/runs` `salary-routes.ts` | `drm.salary_runs`, `drm.salary_run_items` | **REAL** |
| Salary report | `salary-report.tsx` | `GET /api/reports/salary` | `drm.salary_run_items` | **REAL** |
| Edit attendance | `reports-edit-att.tsx` | `/api/attendance/edits` `attendance-edit-routes.ts` | `drm.attendance_edit_requests` | **REAL** |
| Day target | `reports-day-target.tsx` | `GET /api/reports/day-target` `reports-routes.ts` | `drm.targets`+`gm_entries`+`user_activities` | **REAL** (was a 501 stub, fixed in a prior stage) |
| Diagnosis | `reports-diagnose.tsx` | `GET /api/reports/diagnose` `diagnosis-report-routes.ts` | `drm.diagnosis_reports` | **REAL — data-source mismatch NOT present** (explicitly does not reuse BV data) |
| BV report | `bv-report-new.tsx`/`user-reports.tsx` | `GET /api/reports/bv`, `/api/bv-reports` `reports-routes.ts` | `drm.bv_reports`+`drm.gm_entries` | **REAL** — metrics computed (`bv-report.service.ts`); *validate metric definitions in a later stage* |
| Events | `reports-event.tsx` | `GET /api/events/report` `events-routes.ts` | `drm.events` | **REAL** (not the legacy `/api/reports/event`) |
| Reception | `reports-reception.tsx` | `GET /api/reports/reception` `stage3-reports-routes.ts` | `drm.meetings` (reception-type) | **REAL** |

**Net:** the data-source mismatches the Patch 3 report worried about (DIAG, BV) are
**not** present in the current code — diagnose uses its own table and BV computes
from `gm_entries`. Remaining report work is metric-definition validation (BV) and
authz consolidation, not data-source replacement.

## 15. Recommended implementation order

1. **Stage 1 — Security/RBAC hardening (P0-1, P0-2, P0-4, P0-5):** (a) rotate +
   move the committed `JWT_SECRET` to a Replit-managed secret (user-approved — it
   invalidates active sessions); (b) add a `drm.invoices` status state-machine +
   action-level role gate, **reusing** `server/services/invoice-workflow.service.ts`
   (already governs `drm.product_posting_invoices`) as the pattern — do not build a
   duplicate; (c) allow-list the **4 genuine** raw `...req.body` writers (service
   followups/complaints/renewals + notice update) via the `pickWritable` pattern.
   Leave the zod-parsed create routes alone.
2. **Stage 2 — Cross-department / service bridges (P0-3, P1-1, P1-2):** implement (or
   formally defer with a product decision) the Service→GM/VAS/BV bridges and the
   GM/VAS/BV service reports; replace view-only status linking with real sync where
   the report requires it.
3. **Stage 3 — Penalty hardening (P1-3, P1-4):** schema-validate the penalty update
   path; reconcile/remove the dead `penalty_report` config in `report-permission.ts`.
4. **Stage 4 — Report finishing (BV metric validation; report catalog/export
   consistency; authz consolidation across the 3 systems).**
5. **Stage 5 — GLOBAL hygiene (GLOBAL-001 direct fetch → shared helper; GLOBAL-002
   raw SQL → parameterize/whitelist; MOCK_AUTH config hygiene).**
6. **Stage 6 — P1 modules (lead import/dedupe/follow-ups, GM/BV lifecycle, PMS/
   product/software/service completion, DRM static pages).**
7. **Stage 7 — P2 UI/UX polish + QA/UAT matrix.**
8. **Throughout:** do not fix the 56 `tsc` baseline errors or `db:push` as part of
   feature stages unless a touched file requires it.

See `PATCH3_ISSUE_MATRIX.md` for the per-issue tracking table.
