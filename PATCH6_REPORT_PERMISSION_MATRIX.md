# Patch 6 — Report Permission Matrix (Stage 8 surfaces)

Date: 2026-06-22. Records the **enforced** permission/role-scope for the seven
Stage 8 report surfaces, as a sign-off reference. **No permission or role change
was made** this stage — this documents current behaviour. The canonical matrix
remains `PATCH2_REPORT_PERMISSION_MATRIX.md`
(`server/middleware/report-permission.ts`,
`requireReportPermission(reportKey, action)`); this doc is the Stage 8 view of
it plus the penalty exception.

**Role normalization** and **row-level scope** semantics are unchanged from the
canonical matrix: roles are compared after `normalizeRole()`; `admin` /
`super_hod` are always allowed; "own data only" is enforced inside handlers, not
by the guard.

## Matrix (view + export)

| Report | report key | endpoint | view roles (besides admin/super_hod) | export roles | export audit action |
|---|---|---|---|---|---|
| Raw Attendance | `raw_attendance` | `GET /api/reports/raw-attendance` (+`/export`) | account_manager, hr, hr_manager, hod | account_manager, hr, hr_manager | `raw_attendance.export` |
| Salary | `salary_report` | `GET /api/reports/salary` (+`/export`) | account_manager, hr, hr_manager, hod | account_manager, hr, hr_manager | `salary.export` |
| Event | `event_report` | `GET /api/reports/event` (+`/export`) | account_manager, hod, reception_manager | account_manager, hod | `event_report.export` |
| Reception | `reception_report` | `GET /api/reports/reception` (+`/export`) | reception_manager, reception, account_manager, hod | reception_manager, account_manager | `reception_report.export` |
| Daily Target | `day_target` | `GET /api/reports/day-target` (+`/export`) | account_manager, hod, hr, hr_manager, sales_manager, dd_manager, service_manager, reception_manager | account_manager, hod | `day_target.export` |
| BV | `bv_report` | `GET /reports/bv` (+`/export`) | account_manager, hod, sales_manager, sales_assistant_manager, sales_executive, dd_manager | account_manager, hod, sales_manager | `bv_report.export` |
| Penalty | *(local, row-aware)* | `/api/penalties/*` | see penalty exception below | n/a (no export) | n/a |

> Export-role columns above reflect the canonical `report-permission.ts` matrix;
> they were **not** modified this stage.

## Penalty — intentional row-aware exception (PEN-001)

Penalty does **not** use the flat `REPORT_PERMISSION_MATRIX` `penalty_report`
entry. Its access is decided by a single cohesive source,
`server/middleware/penalty-permission.ts`, because the rules are **row-aware**
in a way the role→page matrix cannot express:

- **create**: full-access (`admin`/`super_hod`), `hod`, and any managerial role
  (`isManagerialRole`).
- **decide (approve/reject)** and **void**: full-access and `hod` only.
- **view reports**: full-access, `hod`, HR (`hr`/`hr_manager`/any `*hr*`).
- **row-scope** (`getAllowedEmployeeIds`): full-access / HR → all; `hod` /
  managerial → their **department** (+ self); everyone else → **self only**.
  `acknowledge` is restricted to the penalised employee themselves.

Switching penalty to the static matrix would **change** which roles can act
(forbidden without management confirmation), and would drop the department
row-scope. The permission logic is therefore kept verbatim and merely
**centralised** into one module this stage — behaviour is identical to before.

## Notes

- Every export listed above writes exactly one audit row (rule A.5); see
  `PATCH6_REPORT_EXPORT_PARITY_RESULTS.md`.
- The guard fails closed (401/403) with the standard sanitized error envelope;
  unauthenticated calls to all listed endpoints return 401.
