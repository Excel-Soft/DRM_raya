# API Contract Inventory — Active Backend

This inventory covers the **active** Express server (`server/`, mounted by
`server/routes.ts` → `registerRoutes`). The legacy `src/` tree is NOT mounted at
runtime and is excluded.

## Conventions

- **Auth required**: unless noted "public", every `/api/*` route sits behind the
  JWT `authMiddleware` (`server/auth.middleware.ts`), mounted globally via
  `app.use("/api", authMiddleware)` in `routes.ts`. Unauthenticated requests
  return **401** with `{ error }`. After auth, `checkAllowedIp` (optional, env
  gated) and `checkUrlPermission` (role/URL RBAC) run for protected routes.
- **Allowed roles**: best-effort. Most route-level role gating is done by the
  URL-permission middleware (DB-driven) rather than per-route `requireRole`
  calls, so "Any (RBAC)" means access is decided by the role/URL permission
  table. Explicit per-route gates are noted where present.
- **Response shape**: list endpoints are commonly either a raw array or a
  paginated `{ data, total, page, pageSize }`-style object; detail endpoints
  return a single object; error responses return `{ error }` or, for routes
  adopting the Stage 10 envelope, `{ success:false, error:{ code, message }, message }`.
- **Status** column: `verified` = path confirmed by grep of the route file.

## Auth (`server/auth.routes.ts`, mounted `/api/auth`, public)

| Route | Method | Auth required | Allowed roles | Frontend caller(s) | Request | Response | Status |
|---|---|---|---|---|---|---|---|
| /api/auth/login | POST | No (public) | — | `pages/auth.tsx` | `{ email, password }` | `{ token, user }` / 401 `{ error }` | verified |
| /api/auth/signup | POST | No (disabled in prod) | — | `pages/auth.tsx` | `{ fullName, email, password }` | `{ user }` / 403 / 409 | verified |
| /api/auth/me | GET | Yes | Any (self) | `queryClient` / app shell | `{ id, fullName, email, role, roles, ... }` | verified |
| /api/auth/logout | POST | Yes | Any (self) | top-bar | `{ success:true }` | verified |
| /api/auth/refresh | POST | Yes | Any (self) | session refresh | `{ token, user }` | verified |
| /api/auth/set-active-role | POST | Yes | Any (own roles) | role switcher | `{ roleId }` | `{ success, token, user }` / 403 | verified |
| /api/auth/reset-password | POST | No (public) | — | `pages/auth.tsx` | `{ email, newPassword }` | `{ success }` | verified |
| /api/auth/forgot-password | POST | No (public) | — | `pages/auth.tsx` | `{ email }` | `{ success, message }` | verified |
| /api/auth/reset-password-with-token | POST | No (public) | — | `pages/auth.tsx` | `{ email, token, newPassword }` | `{ success }` | verified |

Health (public): `GET /health/db`, `GET /api/health/db`, `GET /health/auth`,
`GET /api/health/auth`.

## Users / RBAC (`server/users-routes.ts` `/api/users`; `rbac-routes.ts` `/api`)

| Route | Method | Auth | Roles | Frontend caller(s) | Request | Response | Status |
|---|---|---|---|---|---|---|---|
| /api/users | GET | Yes | Any (RBAC) | user-list.tsx | query filters | user list | verified |
| /api/users | POST | Yes | Any (RBAC) | add-user.tsx | user body | created user | verified |
| /api/users/:id | GET | Yes | Any (RBAC) | user-report.tsx | — | user | verified |
| /api/users/:id | PATCH | Yes | Any (RBAC) | add-user.tsx | partial user | updated user | verified |
| /api/users/:id/status | PATCH | Yes | Any (RBAC) | user-list.tsx | `{ isActive }` | updated | verified |
| /api/users/:id | DELETE | Yes | Any (RBAC) | user-list.tsx | — | `{ success }` | verified |
| /api/users/groups | GET/POST | Yes | Any (RBAC) | user-groups.tsx | group body | group(s) | verified |
| /api/users/groups/:id | PATCH/DELETE | Yes | Any (RBAC) | user-groups.tsx | — | updated | verified |
| /api/users/:id/team-members | GET/POST | Yes | Any (RBAC) | user mgmt | member | list | verified |
| /api/users/:id/team-members/:memberId | DELETE | Yes | Any (RBAC) | user mgmt | — | `{ success }` | verified |
| /api/users/:id/impersonate | POST | Yes | admin (RBAC) | admin dash | — | `{ token }` | verified |
| RBAC role/permission routes | GET/POST/... | Yes | admin (RBAC) | policies-settings.tsx, user-groups.tsx | — | role/perm data | verified |

## Sales / Customers / Leads (`server/sales-routes.ts`, mostly `/api/sales/*`)

| Route | Method | Auth | Roles | Frontend caller(s) | Response | Status |
|---|---|---|---|---|---|---|
| /api/sales/overview | GET | Yes | Any (RBAC) | sales dashboards | overview metrics | verified |
| /api/sales/customers | GET | Yes | Any (RBAC) | customer-list.tsx | customer list | verified |
| /api/sales/customers | POST | Yes | Any (RBAC) | add-customer.tsx | created | verified |
| /api/sales/customers/:id | GET | Yes | Any (RBAC) | customer detail | customer | verified |
| /api/sales/customers/:id/followups | GET | Yes | Any (RBAC) | customer detail | followups | verified |
| /api/sales/customers/:id/grade | PATCH | Yes | Any (RBAC) | customer-list.tsx | updated | verified |
| /api/sales/customers/:id/stage | PATCH | Yes | Any (RBAC) | pipeline | updated | verified |
| /api/sales/invoice-pool | GET | Yes | Any (RBAC) | invoice-pool.tsx | list | verified |
| /api/sales/targets/summary | GET | Yes | Any (RBAC) | sales-targets.tsx | summary | verified |
| /api/sales/targets/ab \| /vas | GET | Yes | Any (RBAC) | ab-report.tsx / vas | data | verified |
| /api/sales/pipeline-summary | GET | Yes | Any (RBAC) | pipeline-summary.tsx | summary | verified |
| /api/sales/appointments | GET/POST | Yes | Any (RBAC) | appointments.tsx | list/created | verified |
| /api/sales/appointments/:id/end | PATCH | Yes | Any (RBAC) | appointments.tsx | updated | verified |
| /api/sales/tracing/* | GET/POST/PATCH | Yes | Any (RBAC) | tracing.tsx | list/detail | verified |
| /api/sales/lead-pools/summary \| /list | GET | Yes | Any (RBAC) | lead-pools.tsx | list | verified |
| /api/sales/leads/:id/actions | POST | Yes | Any (RBAC) | lead-pools.tsx | result | verified |
| /api/sales/leads/:id | PATCH | Yes | Any (RBAC) | lead-pools.tsx | updated | verified |
| /api/sales/duplicates/find | POST | Yes | Any (RBAC) | duplicate-checker.tsx | matches | verified |
| /api/customers/add | POST | Yes | Any (RBAC) | add-customer.tsx | created | verified |
| /api/crm/* (customers, activities, meetings, search) | GET/POST | Yes | Any (RBAC) | crm pages | data | verified |

## GM / BV pools (`gm-pool-routes.ts`, `gm-bv-pool-routes.ts`)

| Route | Method | Auth | Roles | Status |
|---|---|---|---|---|
| /api/gm-pool/* | GET/POST/PATCH | Yes | Any (RBAC) | verified (registrar mounted) |
| GM/BV pool entry endpoints | GET/POST/PATCH | Yes | Any (RBAC) | verified |

## Accounts (`account-routes.ts` `/api/account*`, `office-account-routes.ts` `/api/office`)

| Route | Method | Auth | Roles | Frontend caller(s) | Status |
|---|---|---|---|---|---|
| /api/office/* (account heads, vas, expenses, trial balance) | GET/POST | Yes | account/admin (RBAC) | office-* pages | verified |
| /api/office/vas-documents | GET | Yes | Any (RBAC) | vas-documents.tsx | verified |
| Account ledger / invoices / GM entries | GET/POST | Yes | account/admin (RBAC) | account-* pages | verified (registrar mounted) |

## Attendance / HR (`attendance-routes.ts`, `attendance-edit-routes.ts`, `todo-routes.ts`, `leave-routes.ts`, `overtime-routes.ts`, `loan-routes.ts`, `salary-routes.ts`, `late-coming-routes.ts`)

| Route | Method | Auth | Roles | Status |
|---|---|---|---|---|
| /api/attendance/todo | GET | Yes | Any (RBAC) | verified |
| /api/attendance/todo | POST | Yes | Any (RBAC) | verified |
| /api/attendance/todo/categories \| /participants | GET | Yes | Any (RBAC) | verified |
| /api/attendance/edits | GET/POST | Yes | Any (RBAC) | verified |
| /api/attendance/edits/:id/approve \| /reject | PATCH | Yes | manager/hod (RBAC) | verified |
| /api/attendance/raw | GET | Yes | Any (RBAC) | verified |
| /api/leave, /api/leave/:id | GET/POST | Yes | Any (RBAC) | verified |
| /api/leave/:id/cancel | PATCH | Yes | Any (self) | verified |
| /api/admin/leaves | GET | Yes | admin/hod (RBAC) | verified |
| /api/overtime, /api/overtime/:id | GET/POST/DELETE | Yes | Any (RBAC) | verified |
| /api/overtime/:id/approve \| /reject | PATCH | Yes | manager/hod (RBAC) | verified |
| /api/loans, /api/loans/:id | GET/POST/DELETE | Yes | Any (RBAC) | verified |
| /api/loans/:id/manager-approve \| /hod-approve \| /reject \| /complete | PATCH | Yes | manager/hod (RBAC) | verified |
| /api/salary/preview \| /runs | GET/POST | Yes | account/admin (RBAC) | verified |
| /api/salary/runs/:id/status | PATCH | Yes | account/admin (RBAC) | verified |
| /api/drm/late-coming | GET/POST | Yes | Any (RBAC) | verified |

## PMS (`pms-routes.ts`)

| Route | Method | Auth | Roles | Frontend caller(s) | Status |
|---|---|---|---|---|---|
| /api/pms/stats | GET | Yes | Any (RBAC) | pms dashboards | verified |
| /api/pms/projects | GET | Yes | Any (RBAC) | pms-running-projects.tsx | verified |
| /api/pms/projects/:id | GET | Yes | Any (RBAC) | pms project detail | verified |
| /api/pms/projects/:id/financials | GET | Yes | Any (RBAC) | pms-project-report.tsx | verified |
| /api/pms/tasks | GET | Yes | Any (RBAC) | pms-tasks.tsx | verified |
| /api/pms/tasks/board | GET | Yes | Any (RBAC) | pms-team-workspace.tsx | verified |
| /api/pms/tasks/:id | GET | Yes | Any (RBAC) | pms task detail | verified |
| /api/pms/tasks/:id/comments | GET | Yes | Any (RBAC) | pms task detail | verified |
| /api/pms/running-projects[/summary] | GET | Yes | Any (RBAC) | pms-running-projects.tsx | verified |

## Product Posting / Software workflow (`server/routes/*`, `posting-data-routes.ts`)

| Route | Method | Auth | Roles | Status |
|---|---|---|---|---|
| /api/product-posting/phase-definitions | GET | Yes | Any (RBAC) | verified |
| /api/product-posting/commission-slabs | GET | Yes | Any (RBAC) | verified |
| /api/product-posting/manager/queue | GET | Yes | `requireRole` product_posting_manager/dd_manager/qa_manager/admin | verified |
| /api/product-posting/qa/queue | GET | Yes | `requireRole` qa_manager/admin | verified |
| /api/product-posting/verification/queue | GET | Yes | `requireRole` verification_manager/admin | verified |
| /api/product-posting/report-links | GET | Yes | Any (RBAC) | verified |
| /api/product-posting/task/:taskId/report-links | GET | Yes | Any (RBAC) | verified |
| /api/invoices, /api/projects, /api/tasks, /api/notifications | GET/POST/... | Yes | Any (RBAC) | verified (routers mounted) |
| /api/software/* | GET/POST/... | Yes | Any (RBAC) | verified (router mounted) |
| /api/posting/products | GET | Yes | Any (RBAC) | verified |

## Service (`service-core-routes.ts`, `service-executive-routes.ts`, `service-manager-routes.ts`, `service-reports-routes.ts`, `service-pool-routes.ts`)

| Route | Method | Auth | Roles | Frontend caller(s) | Status |
|---|---|---|---|---|---|
| /api/service/followups/due | GET | Yes | Any (RBAC) | service-monthly-followup.tsx | verified |
| /api/service/complaints | GET | Yes | Any (RBAC) | service-complaint-list.tsx | verified |
| /api/service/dropouts | GET | Yes | Any (RBAC) | service-dropout-customer.tsx | verified |
| /api/service/renewals | GET | Yes | Any (RBAC) | service pages | verified |
| /api/service/gm-report \| /vas-report \| /bv-report | GET | Yes | Any (RBAC) | service reports | verified |
| Service pool / executive / manager endpoints | GET/POST/PATCH | Yes | service roles (RBAC) | service-* pages | verified (registrars mounted) |

## DRM / DD (`drm-routes.ts`, `dd-manager-routes.ts`, `dd-executive-routes.ts`, `performance-routes.ts`, `increment-routes.ts`, `penalty-routes.ts`, `promotion-routes.ts`, `today-post-routes.ts`, `commission-verification-routes.ts`, `social-accounts-routes.ts`)

| Route | Method | Auth | Roles | Status |
|---|---|---|---|---|
| /api/drm/* (base DRM router) | GET/POST/... | Yes | Any (RBAC) | verified |
| /api/drm/performance/team | GET | Yes | hod/manager (scope-based) | verified (covered by performance test) |
| /api/drm/increment/users \| /report | GET | Yes | hod/manager/admin (RBAC) | verified |
| /api/drm/increment/evaluations | POST | Yes | hod/manager (RBAC) | verified |
| /api/drm/increment/evaluations/:id/decision | PATCH | Yes | hod/admin (RBAC) | verified |
| /api/drm/promotions | GET/POST | Yes | hod/manager (RBAC) | verified |
| /api/drm/promotions/:id[/approve\|/reject] | PATCH | Yes | hod/admin (RBAC) | verified |
| /api/drm/promotions/:id | DELETE | Yes | hod/admin (RBAC) | verified |
| /api/drm/today-posts | GET/POST | Yes | Any (RBAC) | verified |
| /api/drm/today-posts/:id[/complete] | PATCH | Yes | Any (RBAC) | verified |
| /api/drm/social-accounts | GET/POST | Yes | Any (RBAC) | verified |
| /api/drm/social-accounts/:id[/verify] | PATCH | Yes | manager (RBAC) | verified |
| /api/drm/social-accounts/:id | DELETE | Yes | manager (RBAC) | verified |
| Penalty endpoints (penalty-routes.ts) | GET/POST | Yes | hod/manager (RBAC) | verified (registrar mounted) |
| Commission verification endpoints | GET/POST/PATCH | Yes | Any (RBAC) | verified (registrar mounted) |

## Reports (`reports-routes.ts` `/api`, `stage3-reports-routes.ts`, `project-report-routes.ts`, `team-report-link-report-routes.ts`)

| Route | Method | Auth | Roles | Frontend caller(s) | Response | Status |
|---|---|---|---|---|---|---|
| /api/reports/reception | GET | Yes | Any (RBAC) | reports-reception.tsx | report rows | verified |
| /api/reports/projects | GET | Yes | dd/manager (RBAC) | reports-projects.tsx | report rows | verified |
| /api/reports/:type | GET | Yes | Any (RBAC) | various report pages | report rows | verified |
| /api/reports/:type/export | GET | Yes | Any (RBAC) | report export buttons | file/rows | verified |
| /api/reports/summary | GET | Yes | Any (RBAC) | reports-department.tsx | summary | verified |
| /api/reports/user-activities | GET | Yes | Any (RBAC) | user-reports.tsx | rows | verified |
| /api/reports/ledger | GET | Yes | account (RBAC) | ledger-report.tsx | rows | verified |
| /api/reports/gm-entries | GET | Yes | Any (RBAC) | gm-report-new.tsx | rows | verified |
| /api/reports/refund-entries | GET | Yes | Any (RBAC) | refund-report.tsx | rows | verified |
| /api/reports/invoice-entries | GET | Yes | Any (RBAC) | invoice-report.tsx | rows | verified |
| /api/reports/users-list | GET | Yes | Any (RBAC) | report filters | users | verified |
| /api/reports/:reportType/export-csv | GET | Yes | Any (RBAC) | report export | CSV | verified |
| /api/bv-reports[/:id] | GET | Yes | Any (RBAC) | bv-report-new.tsx | rows | verified |

## Support / Training / Events / Misc

| Route | Method | Auth | Roles | Frontend caller(s) | Status |
|---|---|---|---|---|---|
| /api/support/tickets[/:id] | GET/POST/PUT/DELETE | Yes | Any (RBAC) | support-tickets.tsx | verified |
| /api/support/tickets/:id/assign \| /status | POST | Yes | support roles (RBAC) | support-ticket-detail.tsx | verified |
| /api/support/tickets/:ticketId/messages | GET | Yes | Any (RBAC) | support-ticket-detail.tsx | verified |
| /api/support/channels[/:id] | GET/POST/PUT/DELETE | Yes | admin (RBAC) | support settings | verified |
| /api/training/* | GET/POST | Yes | Any (RBAC) | training-center.tsx | verified |
| /api/events | GET | Yes | Any (RBAC) | events-menu.tsx | verified |
| /api/events/:id | GET | Yes | Any (RBAC) | events detail | verified |
| /api/events/report | GET | Yes | Any (RBAC) | reports-event.tsx | verified |
| /api/events/:id/menu-items \| /duties | GET | Yes | Any (RBAC) | events-add.tsx, events-duty-planner.tsx | verified |
| /api/notice-board/* | GET/POST | Yes | Any (RBAC) | notice-board.tsx | verified |
| /api/policies/* | GET/POST | Yes | admin (RBAC) | policies-settings.tsx | verified |
| /api/portfolio/* | GET/POST | Yes | Any (RBAC) | portfolio-list.tsx, add-portfolio.tsx | verified |
| /api/it/* | GET/POST | Yes | it roles (RBAC) | it-* pages | verified |
| /api/reception/* | GET/POST | Yes | reception (RBAC) | reception-dashboard.tsx | verified |
| /api/quotations[/:id] | GET/POST/PUT | Yes | Any (RBAC) | quotation.tsx | verified |
| /api/target-system/* | GET/POST | Yes | Any (RBAC) | target/create-target pages | verified |
| /api/tasks (quick entries) | GET/POST/PATCH/DELETE | Yes | Any (RBAC) | todo-list.tsx, quick-entries-card.tsx | verified |
| /api/performance/summary | GET | Yes | `requireRoles` manager/hod/admin | quick-entries | verified |
| /api/ai/* | GET/POST | Yes | Any (RBAC) | ai-assistant-chat.tsx | verified (router mounted) |
| /api/me/profile, /api/me/settings | GET | Yes | Any (self) | top-bar / user menu | verified |

## Notes / known caveats

- The bulk of role enforcement is handled centrally by `checkUrlPermission`
  (DB role/URL permission table) rather than per-route guards. Explicit
  `requireRole`/`requireRoles` guards exist on product-posting manager/qa/
  verification queues and the quick-entries performance summary.
- `crmRoutes` is mounted twice (`/api/crm` and `/api`) intentionally so
  `/api/customers/search` resolves at the root.
- Exact report paths (`stage3-reports-routes.ts`, `project-report-routes.ts`)
  are mounted **before** the generic `/api/reports/:type` router so they win
  over the parameterized fallback. This ordering is load-bearing.
- No routes here serve binary uploads; "uploads" are URL/string fields (see
  `UPLOAD_SECURITY_NOTES.md`).
- This table is best-effort and derived by grepping the active `server/*-routes.ts`
  files; it is not auto-generated. When adding/removing routes, update this file.
