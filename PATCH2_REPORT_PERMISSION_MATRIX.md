# Patch 2 — Report Permission Matrix

**Scope:** This matrix governs **backend report API actions only**. It is enforced
by `server/middleware/report-permission.ts` (`requireReportPermission(reportKey, action)`),
a thin wrapper over `requireActionPermission` that fails closed (401/403) and
returns the standard sanitized error envelope.

**Two sources of truth (do not merge):**
- **API authorization** — this matrix (`report-permission.ts`).
- **Sidebar/menu visibility** — `drm.menu_permissions` (separate). Hiding a menu
  item is *not* an access control; the API guard is authoritative.

**Role normalization:** roles are compared after `normalizeRole()`. Notably
`super_admin` / `administrator` collapse to **`admin`**; `super_hod` stays
distinct; `accounts_office` / `account` collapse to **`account_manager`**;
`dnd_manager` collapses to **`dd_manager`**. The matrix is written in normalized
keys. `admin` and `super_hod` are allowed **every** action on **every** report.

**Row-level scope:** "own data only" for ordinary executives is enforced inside
the handlers (row filtering by identity), **not** by this guard. The guard only
decides whether the action is permitted at all.

## Stage 1 wiring status
Only **`day_target` / view** is wired to a live endpoint this stage
(`GET /api/reports/day-target`, which returns an honest `501 NOT_IMPLEMENTED`
because the data source is not built yet). The remaining rows below are the
**agreed target matrix**; per-report endpoints are wired in their later stages to
avoid changing existing access behavior all at once (GLOBAL-001).

## Matrix

Legend: ✅ = role allowed (in addition to `admin` + `super_hod`, which are always allowed).

| report route | business owner | frontend page | backend endpoint | view roles | create roles | edit roles | export roles | approve/finalize roles | notes |
|---|---|---|---|---|---|---|---|---|---|
| /reports/raw-attendance | HR / Accounts | reports-raw-attendance.tsx | GET /api/reports/raw-attendance | account_manager, hr, hr_manager, hod | — | — | account_manager, hr, hr_manager | — | attendance source data |
| /reports/salary-create | Accounts | salary-create.tsx | POST /api/reports/salary-create | account_manager, hr, hr_manager | account_manager | account_manager | account_manager | finalize: account_manager | salary generation |
| /reports/salary | Accounts / HR | salary-report.tsx | GET /api/reports/salary | account_manager, hr, hr_manager, hod | — | — | account_manager, hr, hr_manager | — | salary listing |
| /reports/event | Accounts / HOD | reports-event.tsx | GET /api/reports/event | account_manager, hod, reception_manager | — | — | account_manager, hod | — | events report |
| /reports/reception | Reception | reports-reception.tsx | GET /api/reports/reception | reception_manager, reception, account_manager, hod | — | — | reception_manager, account_manager | — | reception scope |
| /reports/edit-att | HR / Accounts | reports-edit-att.tsx | GET/POST /api/reports/edit-att | account_manager, hr, hr_manager, hod | — | — | — | approve: account_manager, hr_manager, hod · finalize: account_manager, hod | attendance corrections |
| /reports/day-target | Accounts / Management | reports-day-target.tsx | **GET /api/reports/day-target (501)** | account_manager, hod, hr, hr_manager, sales_manager, dd_manager, service_manager, reception_manager | — | — | account_manager, hod | — | **wired this stage**; honest 501 until data source exists |
| /reports/diagnose | Sales / Management | reports-diagnose.tsx | GET /api/reports/bv | account_manager, hod, sales_manager, dd_manager, service_manager | — | — | account_manager, hod | — | reads BV data |
| /reports/bv | Sales | reports-diagnose.tsx (GM view) | GET /api/reports/bv | account_manager, hod, sales_manager, sales_assistant_manager, sales_executive, dd_manager | sales_executive, sales_assistant_manager, sales_manager, account_manager | — | account_manager, hod, sales_manager | approve: account_manager, hod | BV report list |
| /reports/bv/new | Sales | bv-report-new.tsx | POST /api/bv-reports | (see bv_report.view) | sales_executive, sales_assistant_manager, sales_manager, account_manager | — | — | — | create BV entry |
| /drm/add-penalty | Design & Development | drm/add-penalty.tsx | POST /api/penalties (DRM) | dd_manager, service_manager, hod, account_manager | dd_manager, service_manager | — | — | approve: hod, account_manager | penalty per DD scope |
| service manager add penalty | Service | service-add-penalty.tsx | POST /api/penalties (service) | dd_manager, service_manager, hod, account_manager | dd_manager, service_manager | — | — | approve: hod, account_manager | penalty per service scope |

## Report keys / actions (helper contract)

- **Report keys:** `raw_attendance`, `salary_create`, `salary_report`,
  `event_report`, `reception_report`, `edit_attendance`, `day_target`,
  `diagnosis_report`, `bv_report`, `penalty_report`.
- **Actions:** `view`, `create`, `edit`, `export`, `approve`, `finalize`, `delete`.
- Any (reportKey, action) pair not listed defaults to **`admin` + `super_hod` only**.
