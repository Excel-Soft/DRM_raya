# Patch 7 — Report Permission Matrix (Runtime Re-verification)

Date: 2026-06-30. Records the **enforced** permission / role-scope for the report
surfaces, re-verified at runtime this stage. **No permission or role change was
made.** The canonical matrix remains
`PATCH2_REPORT_PERMISSION_MATRIX.md` (`server/middleware/report-permission.ts`,
`requireReportPermission(reportKey, action)`); the Stage 8 view is
`PATCH6_REPORT_PERMISSION_MATRIX.md`. This doc adds **executed** evidence.

**Role normalization** and **row-level scope** are unchanged: roles compared after
`normalizeRole()`; `admin` / `super_hod` always allowed; "own data only" is
enforced inside handlers, not by the guard.

## Matrix (view + export) — unchanged

| Report | report key | endpoint | view roles (besides admin/super_hod) | export roles | export audit |
|---|---|---|---|---|---|
| Raw Attendance | `raw_attendance` | `GET /api/reports/raw-attendance` (+`/export`) | account_manager, hr, hr_manager, hod | account_manager, hr, hr_manager | `raw_attendance.export` |
| Salary | *(salary-local `can()`)* | `GET /api/reports/salary` (+`/export`) | self-service view (row-scoped); privileged roles see all | privileged only (`can(...,"export")`) | `salary.export` |
| Event | `event_report` | `GET /api/reports/event` (+`/export`) | account_manager, hod, reception_manager | account_manager, hod | `event_report.export` |
| Reception | `reception_report` | `GET /api/reports/reception` (+`/export`) | reception_manager, reception, account_manager, hod | reception_manager, account_manager | `reception_report.export` |
| Daily Target | `day_target` | `GET /api/reports/day-target` (+`/export`) | account_manager, hod, hr, hr_manager, sales_manager, dd_manager, service_manager, reception_manager | account_manager, hod | `day_target.export` |
| BV | `bv_report` | `GET /reports/bv` (+`/export`) | account_manager, hod, sales_manager, sales_assistant_manager, sales_executive, dd_manager | account_manager, hod, sales_manager | `bv_report.export` |
| Penalty | *(local, row-aware)* | `/api/penalties/*` | see `PENALTY_SCHEMA_PERMISSION_SIGNOFF.md` | n/a (no export) | n/a |

> **Salary is not on the flat `report-permission` matrix.** It uses the salary
> module's own `can()` + `resolveScope()`: any authenticated user may **view**,
> but rows are **scoped to self** unless the role is privileged; **export**
> requires `can(...,"export")`. This is deliberate self-service, not a gap — see
> the runtime evidence below (no cross-user leak).

## Runtime verification (executed)

| Check | Scenario | Expected | Observed |
|---|---|---|---|
| S02 | `sales_executive` → raw-attendance view | 403 | **403** |
| S02 | `hod` → raw-attendance **export** | 403 | **403** |
| S02 | `hod` → raw-attendance view | 200 | **200** |
| S02 | `admin` → raw-attendance view | 200 | **200** |
| S14 | `sales_executive` → salary view | 200 but **0 rows** (self-scoped) | **200, 0 rows** |
| S14 | `admin` → salary view | full set | **200, 6 rows** |
| S14 | `sales_executive` → salary **export** | 403 | **403** |
| S14 | anon → raw-attendance / BV | 401 | **401 / 401** |
| S13 | `sales_executive` → penalty create | 403 | **403** |
| S13 | `admin` → penalty list | 200 | **200** |
| S15 | invalid filter (`month=2026-13`) | 400, no rows | **400, 0 rows** |

**No cross-user leak:** a low-privilege role either receives 403 (raw attendance,
salary export, penalty create) or a **self-scoped** result set (salary view, 0
rows), never another user's data.

## Notes

- The guard fails closed (401/403) with the standard sanitized error envelope.
- Every export writes exactly one audit row (see
  `PATCH7_REPORT_EXPORT_PARITY_RESULTS.md`).
