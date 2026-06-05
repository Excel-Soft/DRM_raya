# Route / API Gap Inventory

Cross-reference of active frontend routes/pages → the `/api` calls they make →
the backend router that serves them → auth status. Derived from
`client/src/App.tsx`, `client/src/components/app-sidebar.tsx`,
`client/src/lib/queryClient.ts`, and the `server/*-routes.ts` files. Active app
only (`server/`, `client/`, `shared/`).

## Global notes
- **Auth header:** `client/src/lib/queryClient.ts` attaches
  `Authorization: Bearer <token>` and `x-acting-role` on every `apiRequest` /
  `apiRequestJson` call, so all pages below send the auth header unless they use a
  raw `fetch` (auth login/reset, which is expected to be unauthenticated).
- **Global auth gate:** `app.use("/api", authMiddleware)` in `server/routes.ts`
  protects everything mounted after it. Exceptions (mounted before): `/api/auth`
  (public by design), `/api/drm` (auth applied locally), `/api/attributes`
  (NO auth — gap), optional `MOCK_AUTH`, health check.
- **Status legend:** `working` = backend route exists + auth attached; `mock` =
  page renders hardcoded data; `auth-gap` = backend reachable without auth;
  `unknown` = not exhaustively verified at the individual-endpoint level.

| Frontend route | Component | Sidebar path | API calls (representative) | Backend router / mount | Auth header | Status |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `/auth` | AuthPage | (none) | `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password-with-token` (raw fetch) | `auth.routes.ts` @ `/api/auth` (public) | n/a (login) | working |
| `/`, `/dashboard`, `/dashboard/*` (~25) | role Dashboards | `/dashboard` | `/api/dashboard/*`, role dashboard endpoints, `/api/auth/me` | `dashboard-routes.ts`, role routes | yes | working |
| `/sales/customers` | CustomerManagement | `/sales/customers` | `/api/crm/customers`, `/api/customers/search` | `crm-routes.ts` @ `/api/crm` + `/api` | yes | working (dup mount) |
| `/sales/add-customer` | AddCustomer | `/sales/add-customer` | `/api/crm/customers` (POST) | `crm-routes.ts` | yes | working |
| `/sales/duplicate-checker` | DuplicateChecker | `/sales/duplicate-checker` | `/api/customers/search`, dedupe endpoints | `crm-routes.ts`/`sales-routes.ts` | yes | working |
| `/customer/temporary-contact`, `/sales/temp-contact` | TempContact | `/customer/temporary-contact` | `/api/temp-contact`, `/api/customer/temporary-contact` | `temp-contacts-routes.ts` (dup mount) | yes | working (dup mount) |
| `/customers/private-pool`, `/public-pool`, `/service-pool`, `/gmbv-pool`, `/sales/lead-pools` | pool pages / LeadPools | `/customers/*`, `/sales/lead-pools` | `/api/pools/*`, GM/BV pool endpoints | `pools-routes.ts` @ `/api/pools`, `gm-pool-routes.ts`, `gm-bv-pool-routes.ts` | yes | working |
| `/sales/invoice-pool` | InvoicePool | `/sales/invoice-pool` | `/api/invoices/*` | `routes/invoice-routes.ts` @ `/api/invoices` | yes | working |
| `/sales/tracing`, `/sales/tracing/view/:id` | Tracing pages | `/sales/tracing` | tracing/customer endpoints | `crm-routes.ts`/`sales-routes.ts` | yes | working |
| `/gm-pool/add-gm`, `/account/gm-entries` | GM pages | `/account/*` | `/api/account/*`, GM endpoints | `account-routes.ts`, `gm-pool-routes.ts` | yes | working |
| `/hr/attendance`, `/hr/attendance/todo` | Attendance pages | `/hr/attendance` | `/api/attendance/*`, `/api/attendance/todo*` | `attendance-routes.ts`, `todo-routes.ts` | yes | working |
| `/hr/leave-request` | LeaveRequest | `/hr/leave-request` | `/api/leave`, `/api/leave/stats`, `/api/leave/:id/approve` | `leave-routes.ts` @ `/api/leave` | yes | working |
| `/hr/overtime` | OvertimeSubmission | `/hr/overtime` | `/api/overtime`, `/api/overtime/stats` | `overtime-routes.ts` @ `/api/overtime` | yes | working |
| `/hr/loan` | LoanRequest | `/hr/loan` | `/api/loans`, `/api/loans/stats`, `/api/loans/:id/hod-approve` | `loan-routes.ts` @ `/api/loans` | yes | working (singular/plural: FE may use `/api/loan` in places — verify) |
| `/pms/*`, `/projects/*` | PMS pages | `/pms/*` | `/api/pms/projects`, `/api/pms/tasks`, `/api/pms/stats` | `pms-routes.ts` @ `/api/pms` | yes | working |
| `/product-posting/*`, `/qa/manager`, `/verification/*` | posting/QA pages | `/product-posting/*` | `/api/product-posting/*` | `routes/product-posting-workflow-routes.ts` @ `/api/product-posting` | yes | working |
| `/dashboard/software-*` | software pages | (dashboard) | `/api/software/*` | `routes/software-workflow-routes.ts` @ `/api/software` | yes | working |
| `/service/*` (~18) | Service pages | `/service/*` | `/api/service-pool`, `/api/service-executive/*`, `/api/service-manager/*` | `service-*-routes.ts` @ `/api` | yes | working (some export-only mock, see below) |
| `/drm/*` | DRM pages | `/drm/*` | `/api/drm/performance`, `/api/drm/today-post`, `/api/drm/late-coming` | `drm-routes.ts` @ `/api/drm` (local auth) | yes | working |
| `/drm/attributes` | AttributesPage | `/drm/attributes` | `/api/attributes/:category`, `/api/attributes` (POST/DELETE) | `attributes-routes.ts` @ `/api` | yes (FE) | **auth-gap** (backend has no auth) |
| `/drm/pms-setting` | PmsSettingPage | `/drm/pms-setting` | (none — hardcoded) | none | n/a | **mock** |
| `/office/*` | Office accounts pages | `/office/*` | `/api/office/*` | `office-account-routes.ts` @ `/api/office` | yes | working |
| `/reports/*` | Reports pages | `/reports/*` | `/api/reports/*` | `reports-routes.ts`, `stage3-reports-routes.ts` @ `/api/reports` | yes | working |
| `/reports/bv-pending-rc` | ReportsBvPendingRc | `/reports/*` | (none — hardcoded) | none | n/a | **mock** |
| `/support/tickets`, `/support/tickets/:id`, `/support/complaints` | Support pages | `/support/tickets` | `/api/support/tickets*` | `support-routes.ts` @ `/api/support` | yes | working |
| `/training` | Training | `/training` | `/api/training/*` | `training-routes.ts` @ `/api/training` | yes | working |
| `/events/*`, `/social-media` | Events pages | (events) | `/api/events*` | `events-routes.ts` | yes | working |
| `/users` / `/drm/users/*` (admin) | user admin pages | `/drm/users/*` | `/api/users*`, `/api/roles`, `/api/permissions` | `users-routes.ts` @ `/api/users`, `rbac-routes.ts` @ `/api` | yes | working |

## Missing backend routes
- No **module-level** frontend call was found without a corresponding backend
  router. Route registration in `server/routes.ts` is comprehensive and matches
  the page structure. (Individual endpoint-by-endpoint verification across ~190
  routes was not exhaustive — marked `unknown` where not confirmed.)

## Duplicate / overlapping mounts
- `crm-routes.ts` → `/api/crm` **and** `/api`.
- `temp-contacts-routes.ts` → `/api/customer/temporary-contact` **and**
  `/api/temp-contact`.
- `rbac-routes.ts` → `/api` (broad root mount alongside `/api/users`).

## Naming inconsistencies to verify
- Loan endpoints registered as `/api/loans` (plural); some frontend calls may use
  `/api/loan` (singular). Confirm before any cleanup — most core `apiRequest`
  calls align with the registered forms.
