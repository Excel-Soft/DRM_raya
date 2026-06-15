# WebExcels DRM — Report & Dashboard Catalog

This catalog lists the reporting / list screens shipped in the Service, HR, and
Reports areas, with their route, owning module, data source, available filters,
export options, intended roles, and current data status.

"Data status" is one of:
- **Live** — backed by a real API reading the `drm` schema.
- **Empty state (no source)** — the screen renders an honest empty state; no
  backend data source has been wired in yet. No fabricated rows are shown.
- **Not routed** — the file exists as a scaffold but is not registered in
  `client/src/App.tsx` and is not reachable in the app.

---

## Service Department

| Report / Screen | Route | Module (page file) | Data source | Filters | Export | Roles | Data status |
|---|---|---|---|---|---|---|---|
| Service Pool — Customer List / Tracing | `/service/pool` | `pages/service-pool-dashboard.tsx` | `GET /api/sales/service-pool/list` (repo `service-pool.repository.ts`, `drm.service_pool_entries` + `drm.customers` + `drm.users`) | Search (company / account / DRM id), pagination (page/pageSize) | — | Manager-scoped (server applies `userIds` scope) | Live |
| Service Private Pool — Followup List | `/service/private-pool` | `pages/service-private-pool.tsx` (`FollowupListView`) | No backend source yet (tabs render counts of 0) | Column visibility, search box | Copy / Excel (CSV) / PDF via `lib/export-utils.ts` | Service users | Empty state (no source) |
| Service Private Pool — Customer Attribute / profile | `/service/private-pool` | `pages/service-private-pool.tsx` (`CustomerAttributeView`) | `GET /api/sales/leads/:id/profile` | — | — | Service users | Live |
| Service Commission Verifications | Service Manager dashboard → "Commission Verifications" view | `pages/service-commission-verifications.tsx` (rendered by `service-manager-dashboard.tsx`) | No backend source wired yet | Column visibility, search box | — (no export — must not export mock/empty data) | Service Manager (dashboard view) | Empty state (no source) |

### Service backend reference (already implemented, consumed by service screens/APIs)
- Complaints: CRUD + assign + resolve + close + reopen (`service-core-routes.ts`).
- Followups: list + complete (now requires `outcome`).
- Dropouts: create (requires `reason`) + recover (requires `recoveryNote`).
- Renewals: create (requires `serviceCustomerId`, package/service, due date, amount > 0).
- Documents, GM/VAS/BV reports (`service-reports-routes.ts`).
- GM/VAS/BV creation bridges (`POST /api/service/gm|vas|bv`) intentionally return
  `501 Not Implemented` — they do not create real linked records; use the GM/VAS/BV
  modules instead. (Previously returned a fake success; no frontend calls them.)

---

## HR / Attendance / Salary

| Report / Screen | Route | Module | Data source | Filters | Export | Roles | Data status |
|---|---|---|---|---|---|---|---|
| Salary preview / runs / status / report | HR salary screens | `salary-routes.ts` | `drm` salary tables | Period (with duplicate-period guard), lock | (screen-level) | HR / Admin | Live |
| Attendance edit requests | HR attendance screens | `attendance-edit-routes.ts` | `drm` attendance tables | — | — | HR / Admin / requester | Live |
| Leave / Overtime / Loan lifecycles | HR screens | respective HR routes | `drm` tables | Status | — | HR / Admin / requester | Live |
| To-do tasks (status, attachments, participants) | `/attendance/todo` area | `todo-routes.ts` | `drm.todo_tasks` (raw SQL) | Status, summary | — | Creator / participant / admin | Live |

### Todo participant management
- `PATCH /api/attendance/todo/:id/participants/remove` removes a participant from a
  task. Permission: only the task **creator** or an **admin** may remove. The action
  is recorded via `ActivityLogService` (`TODO_PARTICIPANT_REMOVED`).

---

## Reports

| Report / Screen | Route | Module | Data source | Filters | Export | Roles | Data status |
|---|---|---|---|---|---|---|---|
| Pending BV Report | `/reports/bv-pending-rc` | `pages/reports-bv-pending-rc.tsx` | No backend source yet | User (grouped by role), start/end date, search text | — | Reports viewers | Empty state (no source) |
| Project Activity (PMS setting) | `/drm/pms-setting` | `pages/drm/pms-setting.tsx` | No backend source yet | Search (company) | Copy / Excel / CSV / PDF (guarded: report "no data" when empty) | DRM users | Empty state (no source) |
| Performance graph | (none) | `components/performance-graph.tsx` | Placeholder scaffold | — | — | — | Not routed |
| Audit Logs viewer | `/admin/audit-logs` | `pages/admin/audit-logs.tsx` | `GET /api/audit-logs` (`audit-log-routes.ts`, reads `drm.activity_logs` joined to `drm.users`) | Actor, module, entity type, entity id, action, date range; pagination | — | admin / super_admin / super_hod | Live |

---

## Notes
- Screens marked **Empty state (no source)** must not be populated with fabricated
  rows. When a real endpoint becomes available, wire the query and replace the empty
  constant; the existing empty-state UI already handles the zero-row case.
- Screens marked **Not routed** are retained as scaffolds only and carry a
  `DEPRECATED / NOT ROUTED` header comment. Do not connect them to live data without
  first adding a route and obtaining product sign-off.
