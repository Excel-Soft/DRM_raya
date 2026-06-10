# PATCH 2 — Stage 0 Baseline Audit & Scope Lock

> **Read-only audit.** No fixes implemented, no business workflows changed, no
> files deleted, no destructive DB commands, no mock/fallback data added. This
> document records the *current* state of the Patch 2 scope so later stages can
> be planned and verified.

Date: 2026-06-10
Scope source: the Patch 2 task brief ("WebExcels Specific Not-Working Features
Requirements & Issue Report"). The source `.docx`/`.pdf` itself was **not present
in `attached_assets/`** at audit time, so this baseline is mapped against the
issue-ID list and routes enumerated in the task brief.

---

## 1. App run status

| Check | Result |
|---|---|
| `node -v` | v20.20.0 |
| `npm -v` | 10.8.2 |
| `npm run dev` (`Start application` workflow) | Boots and serves on port 5000 |
| Active runtime | `server/index.ts` (Express serves API + Vite middleware), `client/`, `shared/` |
| `src/` scaffold | Legacy, **not** the active app (left untouched) |

## 2. Build / typecheck status

| Check | Result |
|---|---|
| `npm run check` / `npx tsc --noEmit` | **57 pre-existing errors** (stable baseline, unrelated to Patch 2 scope — see `.agents/memory/tsc-baseline-errors.md`). No new errors introduced by this audit. |
| `npm test` (vitest) | **33 passed / 4 files** (green) |
| `npm run db:push` | **Broken repo-wide** on a pre-existing FK type mismatch; schema must be applied via runtime `ensure*Schema` / `ALTER TABLE ... IF NOT EXISTS`, never `db:push`. |

## 3. Database status

- PostgreSQL, schema `drm`, Drizzle ORM, schema in `shared/schema.ts`.
- Replit-provided database in use (not external Supabase).
- Tables relevant to Patch 2 that **exist**: `penalties`, `salary_runs`,
  `salary_run_items`, `attendance`, `attendance_edit_requests`, `events`,
  `event_speakers`, `meetings`, `customers`, `bv_reports`, `bv_entries`, `users`.
- No table is created/altered by this audit.

---

## 4. Patch 2 issue-by-issue evidence (current state)

### Group 1 — Penalty / Plenty

| ID | Current evidence |
|---|---|
| **PEN-001** (add penalty not saving) | **Not reproduced as broken.** `client/src/pages/drm/add-penalty.tsx` `saveMutation` (≈L201–228) calls real `POST /api/penalties` / `PATCH /api/penalties/:id` via shared `apiRequest`; persists to `drm.penalties`. |
| **PEN-002** (no backend endpoint) | **Endpoint exists.** `server/penalty-routes.ts` registered in `server/routes.ts` (≈L378): POST/GET/PATCH/DELETE under `/api/penalties` incl. `/approval`, `/acknowledge`. |
| **PEN-003** (fake success toast) | **Not present.** Success toasts in `add-penalty.tsx` (≈L222) and `service-add-penalty.tsx` (≈L108) fire only inside `useMutation.onSuccess` after an awaited 2xx. |
| Note | `DEFAULT_HEADS` hardcoded fallback exists in both penalty pages (used only if `/api/penalties/meta` fails). Labels, not fabricated penalty rows. |

### Group 2 — Reports / Accounts Office

| ID | Current evidence |
|---|---|
| **RPT-RAW-001 / -002** (raw attendance) | `client/src/pages/reports-raw-attendance.tsx` → `GET /api/attendance/raw` (`server/attendance-edit-routes.ts` ≈L143). **Honest empty state**: returns `records: []` with a "no source connected" message. No mock rows, read-only. |
| **SAL-CREATE-001 / -002** (salary create) | `salary-create.tsx` → `GET /api/salary/preview` + `POST /api/salary/runs` (`server/salary-routes.ts`). Persists to `drm.salary_runs` / `drm.salary_run_items` in a transaction. **Overtime & "Other Deductions" hardcoded to 0** (no source yet) — values, not fake success. Gated to `SALARY_ROLES`. |
| **SAL-REPORT-001** (salary report) | `salary-report.tsx` → `GET /api/salary/runs` + `/:id`. Reads real run tables. Gated to `SALARY_ROLES`. "Print Slip" uses `window.print()`. |
| **EVT-001** (events report) | `reports-event.tsx` → `GET /api/events/report` (`server/events-routes.ts` ≈L285). Reads `drm.events` + `event_speakers`. **GET report only requires auth** (no managerial gate on read). Export CSV is client-side blob of current rows. |
| **REC-001** (reception report) | `reports-reception.tsx` → `GET /api/reports/reception` (`server/stage3-reports-routes.ts` ≈L148). Reads `drm.meetings ⨝ customers`. Auth only. |
| **EDIT-ATT-001** (attendance edit) | `reports-edit-att.tsx` → `GET /api/attendance/edits`, `PATCH .../:id/approve|reject` (`server/attendance-edit-routes.ts`). Persists to `drm.attendance_edit_requests`. Approve/reject gated to managerial roles. |
| **DAY-TARGET-001** (day activities endpoint) | **Unsupported endpoint.** `reports-day-target.tsx` calls `GET /api/reports/day-target`; this hits the catch-all `GET /api/reports/:type` (`reports-routes.ts` ≈L878), and `day-target` is **not** in the supported set `[loan, vas, gm, bv]` → returns **HTTP 400 "Invalid report type"**. No backend data source / table. |
| **DAY-TARGET-002** (mock fallback) | **Confirmed mock data.** On non-OK response the page falls back to hardcoded rows `"Shaila Khaild"` (`reports-day-target.tsx` ≈L53–54). |
| **DIAG-001 / -002** (diagnose) | **Endpoint exists** (correcting initial scan): `reports-diagnose.tsx` calls `GET /api/reports/bv`, which resolves via the catch-all to `getBvReport` (real data). On null/failure the page shows an honest "No entries found" — no mock rows. The diagnose screen is effectively a thin BV viewer; clarify intended scope vs. the BV Report group. |

### Group 3 — User Reports / BV Report

| ID | Current evidence |
|---|---|
| **BV-001** (data fragmentation) | BV data lives in two tables: `drm.bv_reports` (user-submitted summaries; repo `bv-reports.repository.ts`) and `drm.bv_entries` (ledger-style). Confirm which is authoritative for `/reports/bv`. |
| **BV-002** (pending BV stubbed) | `client/src/pages/reports-bv-pending-rc.tsx` is an **honest empty static page** — `const REPORT_DATA: PendingBvRow[] = []` with a comment that no backend source exists. No `GET /api/reports/pending-bv` route. |
| **BV-003** (export gap) | Backend `GET /api/reports/:reportType/export-csv` (`reports-routes.ts` ≈L1467) handles `gm-entries / refund-entries / invoice-entries / ledger` but **has no `bv` case**. Frontend `user-reports.tsx` `handleExport` (≈L1000) exports real filtered rows **client-side** (CSV/Excel/PDF), so the user-facing export works from loaded data. |
| **BV-004** (fake email success) | `reports-routes.ts` email route (≈L1023) returns `{ success: true }` with note **"Email integration pending"** — a success response with no actual email sent. |

### Group 4 — Global report issues

| ID | Current evidence |
|---|---|
| **GLOBAL-001** (permission model) | Menu/route gating: `app-sidebar.tsx` `hasAccess` → `drm.menu_permissions` (DB `allowedRoleIds`) with `DEPT_NAME_TO_ROLES` hardcoded fallback (≈L334–381); `admin`/`super_admin` bypass. Routes registered in `App.tsx` (≈L349–366). **Action-level** permissions (view/create/edit/export/finalize) are checked inconsistently: penalty/salary/attendance-edit enforce roles server-side; several report GETs (`events`, `reception`, `/reports/:type`) require auth only and filter rows by role rather than gating the action. |
| **GLOBAL-002** (systemic patterns) | Fake success: confined to the email route (BV-004); penalty/salary/bv-create toasts are genuine `onSuccess`. Mock/static fallback rows: `reports-day-target.tsx` (Shaila Khaild). Honest empty states: `reports-bv-pending-rc.tsx`, `reports-raw-attendance.tsx`. Missing loading/empty/error states: pages that destructure `useQuery` with `= []` default and render "No records found" without distinguishing loading vs. error (e.g. `reports-bv-pending-rc.tsx`). Reference "good" pattern: `add-penalty.tsx` (explicit loading + error rows). |

---

## 5. Pages using mock / static fallback data

| Page | Nature |
|---|---|
| `client/src/pages/reports-day-target.tsx` | **Hardcoded mock rows** ("Shaila Khaild") on API failure — should be removed when a real endpoint exists. |
| `client/src/pages/reports-bv-pending-rc.tsx` | Honest empty static (`REPORT_DATA = []`); no fabricated rows. |
| `client/src/pages/salary-create.tsx` | Overtime / Other Deductions hardcoded to `0` (no source yet). |
| `client/src/pages/drm/add-penalty.tsx`, `service-add-penalty.tsx` | `DEFAULT_HEADS` label fallback only (not data rows). |

## 6. Pages showing fake success without a real persisted API call

| Location | Nature |
|---|---|
| `server/reports-routes.ts` email route (≈L1023) | Returns `success: true` ("Email integration pending") with no email delivery — **fake success** (BV-004 / GLOBAL-002). |

No client page was found showing a success toast without an awaited 2xx in the
Patch 2 scope (penalty / salary / BV-create toasts are genuine).

## 7. Missing / unsupported backend endpoints

| Endpoint (frontend expects) | Status |
|---|---|
| `GET /api/reports/day-target` | **Unsupported** — catch-all `/reports/:type` returns 400 for `day-target` (DAY-TARGET-001). |
| `GET /api/reports/pending-bv` | **Missing** — pending-BV page has no backend (BV-002). |
| `GET /api/reports/:reportType/export-csv` (type `bv`) | **No `bv` case** in server-side CSV export (BV-003). |

## 8. Mismatched frontend ↔ backend endpoints

- `reports-diagnose.tsx` calls `/api/reports/bv`; this is served by the generic
  `/reports/:type` dispatcher (type `bv` → `getBvReport`), **not** a dedicated
  diagnose endpoint. Functional, but the screen name and route diverge — confirm
  intended scope.
- `reports-day-target.tsx` calls `/api/reports/day-target`, which silently
  matches the catch-all and 400s; the page hides this behind mock rows.

## 9. Tables found / missing

- **Found:** `penalties`, `salary_runs`, `salary_run_items`, `attendance`,
  `attendance_edit_requests`, `events`, `event_speakers`, `meetings`,
  `customers`, `bv_reports`, `bv_entries`, `users`.
- **Missing / no source:** day-activities (day-target) data, pending-BV source,
  raw-attendance source.

## 10. Permission risks

- Several report GETs (`events`, `reception`, `/reports/:type`) require only
  authentication and rely on row-level role filtering rather than action gating.
- Action-level permissions (export / finalize / edit) are not consistently
  enforced server-side across reports.
- `DEPT_NAME_TO_ROLES` hardcoded fallback in `app-sidebar.tsx` can diverge from
  the DB `menu_permissions` source of truth.
- Salary, penalty, and attendance-edit routes enforce roles server-side (good).

## 11. Recommended implementation order (for later stages — NOT done here)

1. **DAY-TARGET** — add real `/api/reports/day-target` (or supported type) +
   table/source; remove the "Shaila Khaild" mock fallback (highest visibility).
2. **BV-003** — add a `bv` case to server-side CSV export for parity.
3. **BV-004** — make the email route fail honestly until email integration lands
   (no `success: true` without delivery).
4. **BV-001 / BV-002** — decide authoritative BV table; wire or formally retire
   the pending-BV page.
5. **GLOBAL-001** — standardize action-level permission checks across report
   create/edit/export/finalize.
6. **GLOBAL-002** — standardize loading / empty / error states across report
   pages using the `add-penalty.tsx` pattern.
7. **SAL-CREATE** — source overtime / other-deductions instead of hardcoded 0.
8. **DIAG / scope clarification** — confirm whether diagnose is a duplicate BV
   view; align route + screen name.

## 12. Files likely to change in later stages

- Frontend: `reports-day-target.tsx`, `reports-diagnose.tsx`, `user-reports.tsx`,
  `reports-bv-pending-rc.tsx`, `salary-create.tsx`, report pages lacking
  loading/empty/error states.
- Backend: `server/reports-routes.ts` (catch-all types, export-csv `bv` case,
  email route), possibly a new day-target route/source.
- Schema: `shared/schema.ts` only if a day-activities / pending-BV source table
  is added (via runtime `ensure*Schema`, not `db:push`).
