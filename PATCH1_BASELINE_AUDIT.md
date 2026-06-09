# Patch 1 — Baseline Audit (Stage 0)

Inspection-only audit of the active WebExcels DRM codebase against the Patch 1
concerns. **No business logic, schema, workflow, or RBAC code was changed.** Active
runtime = `server/` + `client/` + `shared/` (the `src/` scaffold is legacy and not
mounted).

Method: environment commands + targeted `grep`/file inspection. File:line
references are pointers for Stage 1+, not change requests.

---

## 1. App run status
- `node -v` → **v20.20.0**, `npm -v` → **10.8.2**.
- `npm run dev` → **boots and serves on port 5000.** Note: this environment
  rejects the IPv6 `::` bind (`EAFNOSUPPORT`); the server logs
  `IPv6 bind failed (EAFNOSUPPORT); retrying on 0.0.0.0` and serves on IPv4. This
  fallback already exists in `server/index.ts` (added in a prior stage) — **no new
  boot fix was required for this audit.**
- Background overdue job starts; accounts schema maintenance runs at boot.

## 2. Database status
- PostgreSQL, Drizzle ORM, schema **`drm`**. Connects at boot
  (`[db] connecting host=helium ... db=heliumdb`).
- Health endpoints present: `GET /health/db`, `GET /api/health/db`,
  `GET /health/auth`, `GET /api/health/auth` (all public).
- Schema source: `shared/schema.ts`. No schema change made or needed for boot.

## 3. Current TypeScript / build status
- `npm run check` → **57 errors (stable pre-existing baseline)**. `npm run build`
  passes. See `TYPECHECK_BUILD_REPORT.md`.
- The errors cluster in **invoice UI ↔ schema shape mismatches**, e.g.:
  - `client/src/components/InvoiceCreateForm.tsx:316-317` — product type missing
    `description`/`price`/`unitPrice`.
  - `client/src/pages/account-invoices.tsx:260-266` — invoice type missing
    `agentName`/`currency`/`amount` (frontend expects fields the Drizzle row type
    doesn't expose). This is a real **frontend/backend contract mismatch** (see §14).
- Remaining baseline errors are in `server/reports-routes.ts` / `repositories/*`
  (drizzle enum/`createdBy` typings). Out of scope to refactor in Stage 0.

## 4. P0 risks confirmed
1. **Mass-assignment on financial records** — invoice update spreads the raw body:
   `server/account-routes.ts:1060-1083` does
   `db.update(invoices).set({ ...req.body, updatedAt })` with no field allowlist,
   no status/approval guard. A client can set any column (amount, status, etc.).
2. **Routes mounted before global auth** — in `server/routes.ts` the global JWT
   gate is applied at line **200** (`app.use("/api", authMiddleware)`), but
   `/api/drm` (133) and the attributes router `/api` (139) are mounted **before**
   it. Those routers are only protected if they enforce auth internally — must be
   verified (e.g. `app-sidebar.tsx:475` calls `/api/drm/permissions`).
3. **Broad `...req.body` updates across modules** (validation handling) — found in
   pms-routes (×11), service-core-routes (×4), notice-routes, posting-data-routes,
   loan-routes, overtime-routes, temp-contacts-routes, account-routes (invoice).
   None use a field whitelist / shared validator on the update path.
4. **Approval visibility / RBAC consistency** — many approval endpoints exist
   (see §6) but role gating is inconsistent: some use `requireRole(...)`
   (`routes/invoice-routes.ts:65`, `quick-entries-routes.ts`,
   software/product-posting transition routes), while others rely only on the
   global gate with no per-route role check (e.g. `account-routes.ts` gm-entries
   approve/reject 697/763, several `pms-routes.ts` approvals, `hod-routes.ts`
   approvals).
5. **Possible duplicate workflow routes (workflow sync)** —
   `server/gm-pool-routes.ts` defines `/gm-pool/:id/super-hod-approve` twice
   (lines **849** and **942**) and `super-hod-reject` twice (865/966). The second
   definition is shadowed by Express; intent must be confirmed.
6. **Auth/password/signup** — generally hardened: public signup **disabled in
   production** and defaults to lowest role (`auth.routes.ts:79,83-86`,
   `SIGNUP_DEFAULT_ROLE="sales_executive"`); bcrypt hashing; `forgot-password` /
   `reset-password-with-token` present. Residual: `MOCK_AUTH=true` installs a
   header/env mock user that **bypasses JWT** (`routes.ts:96-130`) — dev-only, must
   stay off in prod (server refuses boot if on in prod).

## 5. Invoice endpoints found
- `server/account-routes.ts`: `GET /api/account/invoices` (923),
  `/invoices/stats` (974), `/invoices/next-number` (1007), `/invoices/:id` (1019),
  `POST /invoices` (1037), `PATCH /invoices/:id` (1060, **broad body**),
  `PATCH /invoices/:id/status` (1086), `DELETE /invoices/:id` (1116).
- `server/routes/invoice-routes.ts` (mounted `/api/invoices`): includes
  `PUT /:id/approve` (65) gated `requireRole("hod","account_manager","admin")`.
- `server/pms-routes.ts:218` `GET /api/pms/invoices/pending-project` (PMS link).
- `server/sales-routes.ts:873,901` `/api/sales/invoice-pool`.
- `server/reports-routes.ts:1250` `GET /reports/invoice-entries`.

## 6. Approval endpoints found
- account-routes: gm-entries `:id/approve` (697), `:id/reject` (763),
  pending-quotations `:id/approve` (1519).
- gm-pool-routes: hod/account-manager/sales-manager/super-hod approve+reject,
  withdraw-approve/reject (613–1053; note duplicates at 849/942, 865/966).
- hod-routes: `approvals/:id/approve` (257), `/reject` (280), `leaves/approve`
  (306), verification withdrawals/update-requests approve+reject (792–906).
- hod-quick-actions: leaves approve/reject (82/98).
- quick-entries-routes: leaves & overtime approve/reject (139–271), `requireRoles`.
- pms-routes: pending-approvals (1341), approvals list/summary/:id (1376–1442),
  `:id/approve` (1442), `:id/reject` (1459).
- routes/invoice-routes: `:id/approve` (65, role-gated).
- penalty-routes: `:id/approval` (351).

## 7. Workflow transition endpoints found
- product-posting: `routes/product-posting-workflow-routes.ts:87`
  `POST /workflows/:projectId/transition` (`requireRole` product_posting/dd/admin).
- software: `routes/software-workflow-routes.ts:86`
  `POST /workflows/:projectId/transition` (`requireRole` software_manager/admin).
- status transitions: account invoices/temp-gm status, pms task/running-project
  status (871/1315), todo status (209), salary run status (291), posting-data
  status (115), support ticket status (160), office cheques status (284),
  pools `/move` (125), sales customer `:id/stage` (3712), users `:id/status` (500).

## 8. Routes using broad body updates
`...req.body` spread directly into an insert/update (no allowlist):
`account-routes.ts:1068`, `temp-contacts-routes.ts:367`, `pms-routes.ts`
(438,695,970,1212,1253,1297,1499,1804,1870,2070,2131),
`service-core-routes.ts` (49,91,239,272), `notice-routes.ts` (55,82),
`posting-data-routes.ts:81`, `loan-routes.ts:123`, `overtime-routes.ts:166`.

## 9. Raw SQL interpolation found
- The vast majority of `pool.query` calls are **parameterized** (`$1,$2,…`) — good
  (e.g. account-routes 1315/2068, dashboard-routes 232/241/645/648).
- **Needs review:** dynamic `${whereSql}` fragments appended to queries in
  `server/crm-routes.ts` (281,343,404,476). Safe only if `whereSql` is built from
  constants/placeholders and never concatenates raw user input. No string
  concatenation of `req.query/params/body` directly into SQL was found, but these
  `whereSql` builders should be confirmed in Stage 1.
- No `sql.raw()` with user input found.

## 10. Routes mounted before auth
- Before `app.use("/api", authMiddleware)` (routes.ts:200): `/api/drm` (133),
  `/api/auth` (136, intentionally public), `/api` attributes router (139), plus the
  public health endpoints (db/auth) and the `MOCK_AUTH` shim (96-130).
- `/api/auth` and health checks are correctly public. **`/api/drm` and the
  attributes router must be confirmed to enforce auth internally** — otherwise they
  are unauthenticated.

## 11. Mock/static pages still present
Components/pages containing mock/sample/placeholder patterns (candidates, to be
confirmed real vs static in Stage 1): `customer-list.tsx`, `performance-graph.tsx`,
`product-posting-manager-widget.tsx`, `public-pool.tsx`, `todo-list.tsx`,
`vas-graph.tsx`, `qa-manager-widget.tsx`, `verification-manager-widget.tsx`,
`app-sidebar.tsx`; pages: `add-customer`, `business-customers`,
`chart-of-accounts`, `create-target`, `drm/pms-setting`, `drm/delay-projects-new`,
`drm/promotion`, `gm-report`, `it-manager-dashboard`, `loan-request`,
`office-account-head`, `reception-dashboard`, `reports-bv-pending-rc`,
`reports-day-target`, `reports-follow-up`, `reports-in-service`,
`sales-manager-dashboard`, `service-commission-verifications`,
`service-pool-dashboard`, `super-admin-dashboard`, `temp-contact`.

## 12. Direct /api fetch calls not using the shared auth helper
The shared helpers are `apiRequest` / `apiRequestJson` / `getAuthHeader` /
`getQueryFn` (`client/src/lib/queryClient.ts`). Direct `fetch("/api/...")` calls
bypass them — some still attach `getAuthHeader()`, others attach **no auth header
and no `credentials`**, risking inconsistent auth:
- With manual auth header: `lead-import-dialog.tsx` (123,144,208,234),
  `customer-monthly.tsx:91`, `target-achieve.tsx:21`, `app-sidebar.tsx:475`,
  `account-gm-entries.tsx` (144,189,204), `create-target.tsx` (44,58),
  `gm-pool-add-gm.tsx` (182,507,539,578), `hod-dashboard.tsx` (1203,1225),
  `CheckDuplicationPage.tsx:121`.
- **No auth header / no credentials (higher risk):**
  `business-customers.tsx:24`, `cheque-system.tsx:50`, `dollar-system.tsx:39`,
  `invoice-report.tsx:74`, `ledger-report.tsx:73`, `office-expenses.tsx` (188,193),
  `chart-data-widget.tsx:37`, `InvoiceCreateForm.tsx` (100,103,204).

## 13. Reports using mock/static data
- Known mock-data exports (from prior stages, see `EXPORT_STANDARD.md`):
  service commission verifications, service dropout customer, service due-VAS.
- Additional report pages flagged by the mock scan for Stage 1 confirmation:
  `reports-bv-pending-rc`, `reports-day-target`, `reports-follow-up`,
  `reports-in-service`, `gm-report`. (Flagged as candidates — verify against their
  query hooks before treating as real.)

## 14. Frontend/backend API mismatches
- **Invoice shape mismatch (confirmed by tsc):** `account-invoices.tsx` expects
  `agentName`, `currency`, `amount`; the `invoices` Drizzle row type exposes
  `total`/`companyName`/etc. (the SQL in `account-routes.ts:947` aliases
  `total as amount` for the raw endpoint, but the typed Drizzle path differs).
- **Uncertain product endpoint:** `InvoiceCreateForm.tsx:100-103` tries
  `/api/sales/products` then falls back to `/api/products` ("Adjust endpoint if
  needed") — endpoint contract is unsettled.
- Other mismatches likely exist where direct `fetch().then(r=>r.json())` is used
  without typing (§12); enumerate in Stage 1.

## 15. Recommended Stage 1 files
1. `server/account-routes.ts` — invoice `PATCH` field allowlist + financial-update
   guard (status/approval protection); align response shape with the UI (§14).
2. `server/routes.ts` — confirm/relocate `/api/drm` + attributes mounting relative
   to `authMiddleware`; document which routers are intentionally public.
3. `server/gm-pool-routes.ts` — resolve duplicate `super-hod-approve/reject`.
4. Shared validation adoption (`shared/validators.ts`) on the broad `...req.body`
   update routes in §8 (start with financial: account/invoice, then pms/service).
5. `client/src/lib/queryClient.ts` adoption — migrate the no-auth direct fetches in
   §12 to `apiRequest`/`getQueryFn`.
6. RBAC consistency pass on the approval endpoints in §6 that lack per-route role
   checks (cross-reference `ROUTE_PERMISSION_MATRIX.md`).

> All items above are **observations for planning**. No fixes were applied in
> Stage 0 beyond confirming the app boots.
