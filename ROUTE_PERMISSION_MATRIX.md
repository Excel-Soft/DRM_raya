# WebExcels DRM — Route & Permission Matrix (Stage 2)

This document maps every frontend route to its page component, the role-based
access controls that apply, and notes about its status. It is the reference for
how RBAC, routing, the sidebar, and permissions line up after Stage 2.

> Generated from `client/src/App.tsx` (route → component), the client route
> guard in `client/src/hooks/useRouteProtection.ts` (`ROUTE_PERMISSIONS`), and
> the sidebar access model in `client/src/components/app-sidebar.tsx`
> (`DEPT_NAME_TO_ROLES` + `hasAccess`).

---

## 1. The permission model (three layers)

Access is enforced at three independent layers. The **backend is the security
boundary**; the two frontend layers are UX guards that hide/redirect away from
screens a user should not use.

1. **Sidebar visibility — `hasAccess()` in `app-sidebar.tsx`.**
   Each menu item carries a `permKey` (a department name). `hasAccess` resolves
   it in this order:
   - DB `menuPermissions` (`isActive`, `allowedRoleIds`) loaded from the DRM
     permission admin — if present and non-empty, these win.
   - Hardcoded fallback map `DEPT_NAME_TO_ROLES` (see §4).
   - Admin / super_admin bypass (only when no DB roles are defined).
   - Final fallback: **hidden** (fail-closed).
   It also applies role aliasing (e.g. `product_posting_executive` ⇄
   `posting_executive`, `product_posting_manager` ⇄ `posting_manager`).

2. **Client route guard — `ROUTE_PERMISSIONS` in `useRouteProtection.ts`.**
   Prefix-matched: if `location.startsWith(prefix)` and the active role is not
   in the allowed list, the user is redirected to their default dashboard
   (`ROLE_DASHBOARDS`). It is **fail-closed**: it does not evaluate until the
   authoritative `/api/auth/me` check has resolved (`ready`), never fails open,
   and only trusts the server-validated `activeRoleId` + `userRoles`.

3. **Backend authorization — Express middleware + per-route checks.**
   `authMiddleware` validates the JWT and sets `req.user` including the
   server-resolved `activeRoleId`. Individual route modules enforce their own
   role/permission rules. This is authoritative regardless of the frontend.

### Active-role model (single source of truth)
- `/api/auth/me` returns `role`, `roles`, and `activeRoleId` (impersonated or
  the user's own active role).
- The top-bar switcher (`top-bar.tsx`) changes the active role via
  `POST /api/auth/set-active-role` (own roles) or `POST /api/admin/impersonate`
  (admins), persists the new token + `userRole` in `sessionStorage`, and
  reloads nav data.
- `App.tsx` feeds `activeRoleId` + `userRoles` from `/api/auth/me` into
  `useRouteProtection`; the sidebar reads the same active role. All layers
  therefore evaluate against one server-validated active role.

### Role normalization
All role strings are normalized through a central `normalizeRole`:
- Server: `server/utils/role-utils.ts` (canonical mapping, used by backend auth
  and ~35 modules).
- Client: `client/src/lib/role-utils.ts` (used by `useRouteProtection` and the
  sidebar helpers).
Both now treat spaces **and hyphens** as separators and collapse the
design-&-development spellings to `dd`:
`super-hod → super_hod`, `d & d / d&d / dnd / d_d / d-d → dd`
(so `dnd_manager`, `d_d_manager`, `d-d-manager` all normalize to `dd_manager`).

---

## 2. Route → component → guard matrix

`Client route-guard` shows the `ROUTE_PERMISSIONS` prefix that governs the
route, or `— (authenticated-only)` when no client-side guard applies (the route
is reachable by any authenticated user via direct URL; visibility is still
governed by the sidebar and data access by the backend — see §5).

| Route | Component | Client route-guard (`ROUTE_PERMISSIONS` prefix) | Status |
|---|---|---|---|
| `/account/ab-report` | AbReport | — (authenticated-only) | active |
| `/account/dollar-system` | DollarSystem | — (authenticated-only) | active |
| `/account/donations` | AccountDonations | — (authenticated-only) | active |
| `/account/gm-entries` | AccountGmEntries | — (authenticated-only) | active |
| `/account/invoices` | AccountInvoices | — (authenticated-only) | active |
| `/account/ledger` | AccountLedger | — (authenticated-only) | active |
| `/account/refund-gm` | AccountRefundGm | — (authenticated-only) | active |
| `/account/temp-gm` | AccountTempGm | — (authenticated-only) | active |
| `/admin` | AdminDashboard | `/admin` | active |
| `/allowed-ip/drm-ip-list` | AllowedIpList | — (authenticated-only) | active |
| `/analytics/gm` | GMReport | `/analytics` | active |
| `/analytics/invoice` | InvoiceReport | `/analytics` | active |
| `/analytics/ledger` | LedgerReport | `/analytics` | active |
| `/analytics/refund` | RefundReport | `/analytics` | active |
| `/analytics/user-activity` | UserActivityReport | `/analytics` | active |
| `/auth` | AuthPage | — (public — login/signup) | active |
| `/customers/gmbv-pool` | LeadPools | `/customers` | active |
| `/customers/private-pool` | DynamicPrivatePool | `/customers` | active |
| `/customers/public-pool` | DynamicPublicPool | `/customers` | active |
| `/customers/service-pool` | ServicePool | `/customers` | active |
| `/customer/temporary-contact` | TempContact | — (authenticated-only) | active |
| `/daily-reports/added-gm` | DailyAddedGmReport | — (authenticated-only) | active |
| `/` | Dashboard | — (authenticated-only) | active |
| `/dashboard/account-manager` | AccountManagerDashboard | — (authenticated-only) | active |
| `/dashboard` | Dashboard | — (authenticated-only) | active |
| `/dashboard/dd-executive` | DDExecutiveDashboard | — (authenticated-only) | active |
| `/dashboard/dd-manager` | DDManagerDashboard | — (authenticated-only) | active |
| `/dashboard/hod` | HodDashboard | — (authenticated-only) | active |
| `/dashboard/it-manager` | ItManagerDashboard | — (authenticated-only) | active |
| `/dashboard/lead-executive` | LeadExecutiveDashboard | `/dashboard/lead-executive` | active |
| `/dashboard/lead-manager` | LeadManagerDashboard | `/dashboard/lead-manager` | active |
| `/dashboard/marketing-manager` | MarketingManagerDashboard | — (authenticated-only) | active |
| `/dashboard/reception` | ReceptionDashboard | — (authenticated-only) | active |
| `/dashboard/sales-assistant-manager` | SalesAssistantManagerDashboard | — (authenticated-only) | active |
| `/dashboard/sales-executive` | SalesExecutiveDashboard | — (authenticated-only) | active |
| `/dashboard/sales-manager` | SalesManagerDashboard | — (authenticated-only) | active |
| `/dashboard/seo-smm` | SeoSmmManagerDashboard | — (authenticated-only) | active |
| `/dashboard/service-assistant-manager` | ServiceAssistantManagerDashboard | — (authenticated-only) | active |
| `/dashboard/service-executive` | ServiceExecutiveDashboard | — (authenticated-only) | active |
| `/dashboard/service-manager` | ServiceManagerDashboard | — (authenticated-only) | active |
| `/dashboard/software-executive` | SoftwareExecutiveDashboard | `/dashboard/software-executive` | active |
| `/dashboard/software-manager` | SoftwareManagerDashboard | `/dashboard/software-manager` | active |
| `/dashboard/super-hod` | SuperHODDashboard | — (authenticated-only) | active |
| `/dashboard/vas-system` | VasSystem | — (authenticated-only) | active |
| `/dd-manager/project-report` | PmsProjectReport | — (authenticated-only) | active |
| `/drm/add-penalty` | AddPenaltyPage | — (authenticated-only) | active |
| `/drm/all-social-accounts` | AllSocialAccountsPage | — (authenticated-only) | active |
| `/drm/attributes` | AttributesPage | — (authenticated-only) | active |
| `/drm/bot-system` | BotSystem | — (authenticated-only) | active |
| `/drm/commission-verification` | CommissionVerificationPage | — (authenticated-only) | active |
| `/drm/delay-project` | DelayProjectPage | — (authenticated-only) | active |
| `/drm/delay-projects-new` | DelayProjectsNewPage | — (authenticated-only) | active |
| `/drm/fb-post` | FbPost | — (authenticated-only) | active |
| `/drm/increment` | IncrementPage | — (authenticated-only) | active |
| `/drm/late-coming` | LateComingPage | — (authenticated-only) | active |
| `/drm/monthly-complete-project` | MonthlyCompleteProject | — (authenticated-only) | active |
| `/drm/online-form` | OnlineForm | — (authenticated-only) | active |
| `/drm/overall-report` | OverallReportPage | — (authenticated-only) | active |
| `/drm/performance` | PerformancePage | — (authenticated-only) | active |
| `/drm/permission` | PermissionPage | — (authenticated-only) | active |
| `/drm/pms-setting` | PmsSettingPage | — (authenticated-only) | active |
| `/drm/promotion` | PromotionPage | — (authenticated-only) | active |
| `/drm/related-customer` | RelatedCustomerPage | — (authenticated-only) | active |
| `/drm/today-post` | TodayPostPage | — (authenticated-only) | active |
| `/drm/users/add` | AddUser | — (authenticated-only) | active |
| `/drm/users/groups` | UserGroups | — (authenticated-only) | active |
| `/drm/users/list` | UserList | — (authenticated-only) | active |
| `/events/add` | EventsAdd | — (authenticated-only) | active |
| `/events/duty-planner` | EventsDutyPlanner | — (authenticated-only) | active |
| `/events/menu` | EventsMenu | — (authenticated-only) | active |
| `/gm-pool/add-gm` | GmPoolAddGm | `/gm-pool` | active |
| `/hr/attendance` | AttendanceManagement | `/hr` | active |
| `/hr/attendance/todo` | AttendanceTodo | `/hr` | active |
| `/hr/leave-request` | LeaveRequest | `/hr` | active |
| `/hr/loan` | LoanRequest | `/hr` | active |
| `/hr/overtime` | OvertimeSubmission | `/hr` | active |
| `/it/backup` | ItBackup | `/it` | active |
| `/it/domains` | ItDomains | `/it` | active |
| `/it/servers` | ItServers | `/it` | active |
| `/it/system-report` | ItSystemReport | `/it` | active |
| `/notice-board` | NoticeBoard | `/notice-board` | active |
| `/office/account-head` | OfficeAccountHead | — (authenticated-only) | active |
| `/office/business-customers` | BusinessCustomers | — (authenticated-only) | active |
| `/office/chart-of-accounts` | ChartOfAccounts | — (authenticated-only) | active |
| `/office/cheques` | ChequeSystem | — (authenticated-only) | active |
| `/office/expenses` | OfficeExpenses | — (authenticated-only) | active |
| `/office/old-account-head` | OfficeOldAccountHead | — (authenticated-only) | active |
| `/office/trial-balance-report` | OfficeTrialBalance | — (authenticated-only) | active |
| `/office/vas-documents` | VasDocumentsPage | — (authenticated-only) | active |
| `/office/vas` | OfficeVasPage | — (authenticated-only) | active |
| `/pms/approvals` | PmsPendingApprovals | `/pms` | active |
| `/pms/completed-projects` | PmsCompletedProjects | `/pms` | active |
| `/pms/project-report` | PmsProjectReport | `/pms` | active |
| `/pms/running-projects` | PmsRunningProjects | `/pms` | active |
| `/pms/status` | PmsStatus | `/pms` | active |
| `/pms/task-history` | PmsTaskHistory | `/pms` | active |
| `/pms/tasks` | PmsTasks | `/pms` | active |
| `/pms/task-templates` | PmsTaskTemplates | `/pms` | active |
| `/pms/team-workspace` | PmsTeamWorkspace | `/pms` | active |
| `/policies` | PoliciesSettings | `/policies` | active |
| `/portfolio-add` | AddPortfolio | — (authenticated-only) | active |
| `/portfolio-view` | PortfolioList | — (authenticated-only) | active |
| `/posting-data/add-keywords` | PostingData | `/posting-data` | active |
| `/posting-data/add-products` | PostingData | `/posting-data` | active |
| `/posting-data/data-verify` | PostingData | `/posting-data` | active |
| `/posting-data/keywords` | PostingData | `/posting-data` | active |
| `/posting-data/link-report` | PostingDataLinkReport | `/posting-data` | active |
| `/posting-data` | PostingData | `/posting-data` | active |
| `/posting-data/restricted-keywords` | PostingData | `/posting-data` | active |
| `/posting-data/verified` | PostingData | `/posting-data` | active |
| `/posting-data/view-keywords` | PostingData | `/posting-data` | active |
| `/posting-data/view-products` | PostingData | `/posting-data` | active |
| `/product-posting/executive` | ProductPostingDashboard | `/product-posting` | active |
| `/product-posting/manager` | ProductPostingDashboard | `/product-posting` | active |
| `/product-posting` | ProductPostingDashboard | `/product-posting` | active |
| `/projects` | DelayProjectPage | — (authenticated-only) | active |
| `/projects/upcoming` | UpcomingProjectPage | — (authenticated-only) | active |
| `/qa/manager` | QAManagerDashboard | `/qa` | active |
| `/reports/attendance` | AttendanceReport | `/reports` | active |
| `/reports/bv/new` | BvReportNew | `/reports` | active |
| `/reports/bv-pending-ecnc` | ReportsBvPendingEcnc | `/reports` | active |
| `/reports/bv-pending-rc` | ReportsBvPendingRc | `/reports` | active |
| `/reports/day-target` | ReportsDayTarget | `/reports` | active |
| `/reports/department` | DepartmentReport | `/reports` | active |
| `/reports/diagnose` | ReportsDiagnose | `/reports` | active |
| `/reports/edit-att` | EditAtt | `/reports` | active |
| `/reports/event` | EventReport | `/reports` | active |
| `/reports/follow-up` | ReportsFollowUp | `/reports` | active |
| `/reports/gm/new` | GmReportNew | `/reports` | active |
| `/reports/in-service` | ReportsInService | `/reports` | active |
| `/reports/loan/:id/edit` | LoanReportEdit | `/reports` | active (dynamic) |
| `/reports/loan/new` | LoanReportNew | `/reports` | active |
| `/reports/projects` | ReportsProjects | `/reports` | active |
| `/reports/raw-attendance` | ReportsRawAttendance | `/reports` | active |
| `/reports/reception` | ReceptionReport | `/reports` | active |
| `/reports/salary-create` | SalaryCreate | `/reports` | active |
| `/reports/salary` | SalaryReport | `/reports` | active |
| `/reports/:type` | UserReports | `/reports` | active (dynamic) |
| `/reports` | UserReports | `/reports` | active |
| `/reports/vas/new` | VasReportNew | `/reports` | active |
| `/sales/add-customer` | AddCustomer | `/sales` | active |
| `/sales/appointments` | AppointmentsPage | `/sales` | active |
| `/sales/create-invoice/:customerId` | CreateInvoice | `/sales` | active (dynamic) |
| `/sales/customers/a-minus` | AMinusCustomersPage | `/sales` | active |
| `/sales/customers` | CustomerManagement | `/sales` | active |
| `/sales/duplicate-checker` | DuplicateChecker | `/sales` | active |
| `/sales/invoice-pool` | InvoicePool | `/sales` | active |
| `/sales/lead-pools` | LeadPools | `/sales` | active |
| `/sales/quotation` | QuotationPage | `/sales` | active |
| `/sales/targets` | SalesTargets | `/sales` | active |
| `/sales/temp-contact` | TempContact | `/sales` | active |
| `/sales/tracing` | TracingPage | `/sales` | active |
| `/sales/tracing/view/:id` | TracingViewPage | `/sales` | active (dynamic) |
| `/service/a-customer` | ServiceACustomer | `/service` | active |
| `/service/b-customer` | ServiceBCustomer | `/service` | active |
| `/service/b-minus-customer` | ServiceBMinusCustomer | `/service` | active |
| `/service/b-plus-customer` | ServiceBPlusCustomer | `/service` | active |
| `/service/bv-checking` | ServiceBvChecking | `/service` | active |
| `/service/bv-document-list` | ServiceBvDocumentList | `/service` | active |
| `/service/complaint-list` | ServiceComplaintList | `/service` | active |
| `/service/dropout-customer` | ServiceDropoutCustomer | `/service` | active |
| `/service/due-vas-payment` | ServiceDueVasPayment | `/service` | active |
| `/service/monthly-followup` | ServiceMonthlyFollowup | `/service` | active |
| `/service/not-follow-customer` | ServiceNotFollowCustomer | `/service` | active |
| `/service/pool` | ServicePoolDashboard | `/service` | active |
| `/service/public-pool` | ServicePublicPool | `/service` | active |
| `/service/todo-list` | ServiceTodoList | `/service` | active |
| `/service/vas-document-list` | ServiceVasDocumentList | `/service` | active |
| `/service/weekly-dropout` | ServiceWeeklyDropout | `/service` | active |
| `/social-media` | SocialMedia | — (authenticated-only) | active |
| `/super-admin` | SuperAdminDashboard | `/super-admin` | active |
| `/support/complaints` | ComplaintsPage | `/support` | active |
| `/support/tickets/:id` | SupportTicketDetail | `/support` | active (dynamic) |
| `/support/tickets` | SupportTickets | `/support` | active |
| `/target-system/add-kwa` | AddKwa | — (authenticated-only) | active |
| `/target-system/create` | CreateTarget | — (authenticated-only) | active |
| `/target-system/daily` | DailyTarget | — (authenticated-only) | active |
| `/target-system/kwa-history` | KwaHistory | — (authenticated-only) | active |
| `/target-system/set` | SetTarget | — (authenticated-only) | active |
| `/target-system/view` | ViewTarget | — (authenticated-only) | active |
| `/team-report/link-report` | PostingDataLinkReport | — (authenticated-only) | active |
| `/training/:category` | TrainingCenter | `/training` | active (dynamic) |
| `/training` | TrainingCenter | `/training` | active |
| `/verification/customers` | CustomersVerification | `/verification` | active |
| `/verification/manager` | VerificationManagerDashboard | `/verification` | active |
| `/workspace` | Workspace | — (authenticated-only) | active |

## 3. Dynamic routes & their states

| Route | Component | Loading | Invalid/missing param | Not-found / error | Unauthorized |
|---|---|---|---|---|---|
| `/sales/create-invoice/:customerId` | CreateInvoice | spinner | "Invalid invoice link" screen when `customerId` absent | "Customer not found" screen on query error / missing customer | "Access Denied" unless `sales_executive` |
| `/support/tickets/:id` | SupportTicketDetail | "Loading ticket details…" | query disabled when `id` absent | "Ticket not found" when ticket missing | backend-enforced |
| `/reports/loan/:id/edit` | LoanReportEdit | "Loading…" | "Invalid report id" when `id` absent | "could not be found / no access" card on query error | backend-enforced |
| `/reports/:type` | UserReports | spinner | invalid `:type` falls back to the **Loan** tab (graceful, no crash) | error card "Failed to load report data" | `/reports` guard + backend |
| `/sales/tracing/view/:id` | TracingViewPage | "Loading…" | query disabled when `id` absent | "Not found." + destructive toast on error | `/sales` guard + backend |
| `/training/:category` | TrainingCenter | "Loading training catalog…" | `:category` is not consumed; the page defaults to the first category (see note) | "No training categories available" empty state | `/training` guard + backend |

> **TrainingCenter note:** the route accepts `:category` but the component drives
> its selection from internal state, not the URL param. This is pre-existing
> behaviour and is intentionally left unchanged (no redesign in Stage 2). It is
> recorded as an observation in the changelog.

## 4. Report dynamic-route aliases (Task G)

The sidebar links `/reports/bv`, `/reports/gm`, `/reports/loan`, `/reports/vas`.
There are **no explicit alias routes** for these in `App.tsx`; they are all
served by the dynamic route `/reports/:type` → `UserReports`, which validates
the param via `isReportType` (`loan | vas | gm | bv`) and selects the matching
tab. An unknown `:type` falls back to the Loan tab. This is confirmed working
and requires no additional routes.

## 5. Sidebar department → roles fallback (`DEPT_NAME_TO_ROLES`)

This hardcoded map is the fallback used by `hasAccess` when the DB has no
explicit `allowedRoleIds` for a menu item's `permKey`.

| Department (permKey) | Allowed roles |
|---|---|
| Admin | admin, super_admin, administrator, junior_admin |
| Super HOD | admin, super_admin, super_hod |
| Head of Department | admin, super_admin, super_hod, hod, software_manager, lead_manager |
| Sales Department | admin, sales_executive, sales_manager, sales_assistant_manager, account_manager, manager, hod, super_hod, verification_manager |
| Lead Department | + lead_manager, lead_executive (superset of Sales) |
| Accounts Department | admin, account_manager, accountant, hod, super_hod |
| Service Department | admin, support_agent, hod, super_hod, service_manager, service_assistant_manager, service_executive |
| Reception Department | admin, support_agent, hod, super_hod |
| IT Department | admin, developer, hod, super_hod, it_manager |
| Software Department | admin, developer, hod, super_hod, it_manager, software_manager, software_executive |
| QA Department | admin, developer, hod, super_hod, qa_manager, verification_manager |
| Verification Department | admin, hod, super_hod, sales_manager, qa_manager, verification_manager |
| Marketing Department | admin, hod, super_hod, marketing_manager |
| D&D Department | admin, hod, super_hod, dd_manager, dd_executive |
| SEO/SMM Department | admin, hod, super_hod, seo_smm_manager |
| Product Posting | admin, hod, super_hod, product_posting_manager |
| Posting Executive | admin, hod, super_hod, product_posting_executive, posting_executive |
| Portfolio | admin, verification_manager, hod, super_hod |
| Target System | admin, sales_manager, hod, super_hod |
| Daily Reports / Allowed IP | admin, super_admin |
| Notice / Notice Board / DRM Policies | admin, super_admin, reception_manager |
| Add Penalty | admin, super_admin, super_hod, hod, hr, hr_manager, dd_manager, dnd_manager, product_posting_manager, software_manager |

(Full map in `app-sidebar.tsx`; broad modules like Customer, Attendance, PMS,
Training, LEAD, User Reports allow most operational roles.)

## 6. Observations — routes without a client route-guard

76 routes have no `ROUTE_PERMISSIONS` prefix and are therefore reachable by any
authenticated user via direct URL (visibility still controlled by the sidebar,
data still protected by the backend). Sensitive examples worth a future
hardening pass: `/drm/users/*`, `/drm/permission`, `/office/*`, `/account/*`,
`/allowed-ip/drm-ip-list`, `/daily-reports/added-gm`, `/target-system/*`. These
are **documented, not changed**, in Stage 2 to avoid unilaterally altering
access for live roles. See the changelog "Unresolved / follow-ups" section.
