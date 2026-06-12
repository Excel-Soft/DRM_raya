---
name: Report authorization is NOT one system
description: The DRM reporting surfaces use 3+ independent authz systems; report-permission.ts is not the single source of truth, and some of its entries are dead config.
---

# Report/operations authorization uses multiple independent systems

Do **not** assume `server/middleware/report-permission.ts`
(`requireReportPermission`) governs every report. It only guards:
raw-attendance, event, reception, edit-att, day-target, and the bv-reports
CRUD/approve endpoints.

Other surfaces authorize themselves:
- **Salary** (`server/salary-routes.ts`) uses its own class system
  (`CLASS_ACTIONS` / `salaryClassForRole` / `classCan`) + `resolveScope`. It
  calls **zero** `requireReportPermission`. Notably HR can generate/edit/export/
  cancel but **not** finalize/mark_paid; HOD = view+approve; manager/executive =
  view-only (row-scoped).
- **Penalty** (`server/penalty-routes.ts`) uses `canCreate`/`canDecide`/`canVoid`/
  `canViewReports` helpers.
- **Diagnose** (`server/diagnosis-report-routes.ts`) uses `accessLevel()` — every
  authenticated role can *view* (scope: all/team/own); only export is restricted.

**Why:** the `salary_create` / `salary_report` (and the `penalty_report`) entries
that exist in `report-permission.ts` are **dead config** — they are not wired to
the actual salary/penalty routes and diverge from real behavior. Trusting them as
the source of truth produced a wrong permission matrix (caught only in review).

**How to apply:** before documenting or changing a report's permissions, grep the
route file for the actual guard (`requireReportPermission` vs `classCan`/`can(` vs
route-local `canX`/`accessLevel`). The per-route guard is authoritative; the
middleware matrix is not, for salary/penalty. Tests confirming real behavior:
`salary-routes.test.ts` (class matrix), `penalty-routes.test.ts`,
`report-permission.test.ts` (middleware only).
