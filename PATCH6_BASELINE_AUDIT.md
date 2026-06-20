# PATCH 6 — Stage 0 Baseline Audit

**Scope:** inspection-only baseline of the active WebExcels DRM app (`server/`,
`client/`, `shared/`) against the *Final Comprehensive Pending Requirements Report*
(Patch 6). **No fixes, no refactors, no deletions, no destructive DB commands.** A
requirement is treated as **Complete only with end-to-end evidence** (frontend +
backend + DB + validation + permissions + audit + reports + QA/UAT). All findings below
cite real files/lines from the current tree.

Date: 2026-06-20. Active runtime: `server/index.ts` → `server/routes.ts`; client
`client/src/App.tsx`. The legacy `src/` scaffold is **not** the active app and was not
audited.

---

## 1. App run status
- **`npm run dev`**: RUNNING on fixed **port 5000** (workflow `Start application`).
  Log: `[db] connecting host=helium db=heliumdb`, `serving on fixed port 5000`,
  `HOD routes mounted at /api/hod`, `accounts schema maintenance completed`.
- **`npm test` (vitest)**: **180/180 passing** (12 files).

## 2. Check / build status
- **`node -v`** = v20.20.0, **`npm -v`** = 10.8.2, `node_modules` present, git tree clean.
- **`npm run check` (tsc --noEmit)**: **0 errors**.
- **`npm run build`** (vite + esbuild): **exit 0** — `dist/index.js` (~2.2 MB) +
  `dist/public/` (assets + favicon) produced; built in ~31s.
- **Non-blocking warnings:** main client chunk > 3 MB (vite `chunkSizeWarningLimit`);
  npm self-update notice. Neither affects behaviour.

## 3. Database status
- PostgreSQL (Replit-provided), schema **`drm`**, Drizzle ORM. Connected at boot
  (`heliumdb`). Schema maintenance runs at startup. No migrations executed this stage.

## 4. Environment variables required
- `DATABASE_URL` (or the discrete `PG*` vars) — Postgres connection.
- `JWT_SECRET` — **currently falls back to a hardcoded dev value** (see SEC-002).
- `NODE_ENV` — gates dev-only behaviour incl. `MOCK_AUTH`.
- `MOCK_AUTH` — dev bypass; **fatally rejected when `NODE_ENV=production`**.
- `SUPPORT_MODULE_ENABLED` — feature flag; Support is 404-gated unless `true`.

## 5. Routes mounted before global auth (SEC-001) — **OPEN (P0)**
In `server/routes.ts`, global `authMiddleware` is applied at **line 222**
(`app.use("/api", authMiddleware)`). Mounted **before** it:
- `app.use("/api/drm", drmRoutes)` — line 155
- `app.use("/api/auth", authRoutes)` — line 158 (login is legitimately public; other
  endpoints in that router need review)
- `app.use("/api", attributesRoutes)` — **line 161** ← see §6.

## 6. Attributes route exposure status (SEC-001) — **OPEN (P0)**
`server/attributes-routes.ts` exposes `GET`/`POST`/`DELETE` for system attributes with
**no internal auth/permission checks**, and is mounted at `routes.ts:161` **before**
global auth. Result: unauthenticated create/delete of system attributes. Highest-priority
risk.

## 7. Action-level RBAC gaps (SEC-003) — **PARTIAL (P1)**
Helpers exist: `requireRole` (`server/auth.middleware.ts:155`), `requirePermission`
(DB-backed module+action matrix, `server/middleware/rbac.middleware.ts:35`),
`requireGmSalesActionPermission` (`server/utils/gm-sales-permissions.ts:139`),
`requireManualInvoiceCreator` (same file, ~225). **Adoption is inconsistent:** many
routes rely only on the global token-validity middleware (no per-action permission);
`invoice-routes.ts` uses coarse `requireRole(...)` (role-creep risk); `attributes-routes.ts`
has none.

## 8. JWT secret & MOCK_AUTH hardening (SEC-002) — **PARTIAL (P0 for prod)**
- Hardcoded fallback: `server/auth.service.ts:6`
  `const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production";`
  → if `JWT_SECRET` is unset in production, tokens are signed with a public constant.
- `MOCK_AUTH` is **hardened**: `routes.ts:108–114` throws `FATAL` when
  `NODE_ENV=production && MOCK_AUTH=true`.

## 9. Raw `req.body` insert/update locations (VAL-001) — **PARTIAL (P1)**
~65% of handlers use zod; ~35% take raw `req.body`. Representative:
- `server/account-routes.ts`: lines 1281, 1613, 2058 (financial payloads destructured raw).
- `server/gm-pool-routes.ts`: line 870 (`approval_status`), line 1199 (`const updates = req.body`).
- `server/sales-routes.ts`: line 1835 (date/time from raw body).
- `server/service-core-routes.ts`: followups 74, complaints 148, dropouts 344, renewals 410
  (raw `{...req.body}` spread into inserts; zod schemas exist in `shared/schema.ts` but
  are not enforced at the handler).
- `server/office-account-routes.ts`: mixed (account-head/expenses validated; others raw).

## 10. Direct frontend `fetch` locations (API-001) — **PARTIAL (P2)**
Protected pages bypassing the shared `apiRequest` (`client/src/lib/queryClient.ts`):
- `client/src/pages/gm-pool-add-gm.tsx:183`
- `client/src/pages/account-gm-entries.tsx:151`
- `client/src/pages/dd-executive-dashboard.tsx:118`
- `client/src/pages/salary-report.tsx:210` (export)
- `client/src/pages/office-vas.tsx:31`
(Most of the app uses `useQuery`/`apiRequest`; these are the outliers.)

## 11. Raw / dynamic SQL risks (SQL-001) — **PARTIAL (P2)**
Most queries use positional params (`$1,$2`). Risks are in **dynamic identifiers / clause
building**:
- `server/utils/sales-tables.ts:21–24`: dynamic table name `drm.sales_${cleanUserId}`
  (safe only if `cleanUserId` is strictly validated).
- `server/repositories/pools.repository.ts:54`: dynamic `WHERE` assembly.
- `server/sales-routes.ts`: query strings built via template literals (values still
  parameterised via `addParam`).
- `server/gm-pool-routes.ts:400`: `LIMIT $n OFFSET $n` (positional — safe).

## 12. Invoice status-update risks (INV-001) — **OPEN (P0/P1)**
`server/account-routes.ts:1847–1874` — `PATCH /api/account/invoices/:id/status` performs
a **raw status update** (`{ status, updatedAt }`, sets `paidAt` on "Paid") with **no
transition validation, no action-permission check beyond auth, no audit**. This bypasses
the safe workflow in `server/routes/invoice-routes.ts` /
`server/services/invoice-workflow.service.ts`.

## 13. GM workflow gaps (INV-002/003, WF-001/002, GM-001..010)
- **INV-002 invoice business validation — Code-complete (UAT pending):** `assertApprovalReadiness`
  (`invoice-workflow.service.ts:186–204`) + `requireManualInvoiceCreator`
  (`invoice-routes.ts:63`).
- **INV-003 approved-invoice → project — Code-complete (UAT pending):** `createOrLinkProjectForApprovedInvoice`
  (`invoice-to-project.service.ts:419–541`), manual trigger
  `POST /api/invoices/:invoiceId/generate-project` (396), automatic config mode.
- **WF-001 cross-department sync — Partial:** `CrossDepartmentStatusService` +
  `drm.cross_department_status_history` exist and are wired into invoice transitions and
  project creation (`invoice-routes.ts:157,201,327`). **Coverage across PMS / service /
  software modules is not yet evidenced** → UAT needed before "Complete".
- **WF-002 PMS transition rules — Partial:** edits blocked via `WORKFLOW_SENSITIVE_FIELDS`
  (`server/pms-routes.ts:488–539`) rather than a formal transition state machine for
  project metadata.
- **GM-001..010 — code-complete via Patch 5 but config-gated (Needs Mgmt Confirmation):** type-specific threshold
  validation (`gm-create-policy.service.ts`), partial/loan final-approval gate
  (`gm-pool-routes.ts:194–248`), threshold re-check at approval (`:68`), default-invoice
  timing. Several behaviours are **gated by pending management confirmation** (thresholds,
  invoice timing, etc.). Per-item GM-001..010 definitions are enumerated in the Patch 6
  source doc and are mapped in the traceability matrix.

## 14. Service 501 / stub bridge routes (SRV-001) — **PARTIAL (P1)**
`server/service-core-routes.ts`: `POST /api/service/gm` (464), `/vas` (468), `/bv` (472)
return **HTTP 501**. Report endpoints `/gm-report`, `/vas-report`, `/bv-report` (436–458)
return **200 JSON stubs**. `server/service-manager-routes.ts:133`
(`/team-work-performance`) returns hardcoded zeros. Business decision required (implement
vs intentionally retire — see Management doc).

## 15. Service raw validation gaps (SRV-002) — **PARTIAL (P1)**
Create routes for followups/complaints/dropouts/renewals spread raw `req.body` into
inserts (see §9). Zod schemas exist (`insertServiceFollowup/Complaint/...Schema`) but are
not enforced; POST actions are not gated by action-level permissions (only list scoping).
**COM-001** communication lifecycle is **code-complete** (UAT pending) (`CommunicationService.log()` →
`drm.communication_logs`, triggered across lifecycle) — caveat: fire-and-forget (`void`)
logging silently drops timeline entries if the log write fails.

## 16. Office Accounts submodule status
- **OFF-001 Account Head — Partial:** UI list hardcoded
  (`client/src/pages/office-account-head.tsx:32–179`) while a **working** persisted API
  exists (`/api/office/account-heads`, `office-account-routes.ts:130`,
  `insertAccountHeadSchema`, `requireFinancialPermission`). UI not wired to API.
- **OFF-002 Old Account Head — Open (stub):** `office-old-account-head.tsx:20`
  `handleSearch` only `console.log`; table hardcoded "No records found"; no backend.
- **OFF-003 Trial Balance — Open (stub):** `office-trial-balance.tsx:100` `handleGenerate`
  is a no-op `console.log`; no computation/results.
- **OFF-004 Office Expenses — Partial (UI error-state polish):** full CRUD `/api/office/expenses`,
  `insertOfficeExpenseSchema`, `requireFinancialPermission`. Minor: client surfaces raw
  backend error text (`office-expenses.tsx:225`).
- **OFF-005 Office VAS — Partial:** `office-vas.tsx:31` uses direct `fetch`; read-only
  view derived from paid non-Alibaba `invoices` (`office-account-routes.ts:570–582`); does
  not use a dedicated `officeVas` table.
- **OFF-006 overall — Partial/Transition:** backend infra robust (schemas, routes, audit
  via `AuditLogService`); UI gaps in Trial Balance, Old Account Head, Account Head wiring.

## 17. Server Names UI/API status (DOM-001/002)
- **DOM-001 Server Names — Code-complete (UAT pending):** `client/src/pages/it-servers.tsx` `submitServerForm`
  (190–212) → `saveServerMutation` (139–157) → `POST/PATCH /api/it/servers` →
  `createServerHandler`/`updateServerHandler` (`it-assets-routes.ts:86–189`) → repository
  Drizzle insert/update. Persists.
- **DOM-002 registry/hosting — Partial:** Servers full CRUD; **Domains** GET/POST only;
  **Backups** GET/POST only; **Registries** GET/DELETE only; **Hosting** GET/DELETE only
  (missing create/update or update/delete per entity). The combined "Add Domain" submit
  button (`it-servers.tsx:346`) is **orphaned/no-op**.

## 18. Social Media local-only status (SOC-001) — **Code-complete; not local-only (UAT pending)**
`client/src/pages/social-media.tsx` persists via react-query mutations to
`POST/PATCH /api/social-media/posts` and an action endpoint; backend mounted at
`routes.ts:419` over a `social_media_posts` table. The Patch 6 assumption of "local-only"
is **not** confirmed by the current code.

## 19. Support active route/sidebar status (SUP-001) — **Partial (soft-disabled)**
Visible in sidebar (`app-sidebar.tsx:220–223`) and routed (`App.tsx:353–355`, gated by
`isSupportModuleEnabled()` → renders `SupportInactive`). Backend mounted
(`routes.ts:281`) but **404-gated** unless `SUPPORT_MODULE_ENABLED=true`
(`routes.ts:99–104`). Management decision required: fully remove vs keep soft-disabled.

## 20. Report signoff gaps (REP-001..005, PEN-001)
All implemented with export parity and role-scope; the open items are **business-rule
confirmations**, not code gaps:
- **REP-001 Raw Attendance — Code-complete; Needs Mgmt Confirmation (source)** (`stage3-reports-routes.ts:452/503`,
  `buildRawAttendanceFilters:150`). Confirm `drm.attendance` is the sole source vs biometric.
- **REP-002 Salary — Needs Mgmt Confirmation (formula)** (`salary-routes.ts` `computeSalaryLine:256`, lifecycle
  `ALLOWED_NEXT:561`). **Mgmt sign-off required:** `basicSalary/30` basis and "no
  late-penalty" policy (lines 192/196).
- **REP-003 Event & Reception — Code-complete (UAT pending)** (`stage3-reports-routes.ts:323/340`,
  `resolveReceptionScope:40`).
- **REP-004 Daily Target — Code-complete; Needs Mgmt Confirmation (rule)** (`reports-routes.ts:1109/1131`). Confirm achievement
  counts only **Approved** GMs.
- **REP-005 BV Report — Code-complete; Needs Mgmt Confirmation (migration)** (`reports-routes.ts:1192/1219`, `bv_reports` canonical;
  legacy `package/method` filters rejected 400 at 307–309). Confirm legacy filters are
  permanently retired.
- **PEN-001 Penalty — Code-complete (UAT pending)** (`penalty-routes.ts` create 264 / approve 405 / void 526;
  owner-edits-only-while-PENDING; RBAC). No sign-off required.

## 21. UAT / build / governance gaps (QA-001/002)
- **QA-001 — Partial:** automated build/type-check/tests are green (§§1–2); **role-based
  browser UAT is not yet executed/recorded** for the open items.
- **QA-002 — Open:** evidence-based Definition of Done is defined this stage
  (`PATCH6_DEFINITION_OF_DONE.md`) but UAT evidence must be attached per requirement
  before any item is marked Complete.

---

## Top P0 risks (confirmed with evidence)
1. **SEC-001** — Attributes API mounted before global auth, no internal RBAC
   (`routes.ts:161`, `attributes-routes.ts`). Unauthenticated create/delete of system
   attributes.
2. **INV-001** — Unsafe raw invoice status update with no transition/permission/audit
   (`account-routes.ts:1847–1874`); financial-integrity risk.
3. **SEC-002** — Hardcoded JWT fallback secret (`auth.service.ts:6`); production token
   forgery risk if `JWT_SECRET` is unset.

Secondary (P1): SEC-003/VAL-001 action-RBAC + raw `req.body` across financial/service
routes; SRV-001/002 service bridge stubs + unvalidated service inserts.
