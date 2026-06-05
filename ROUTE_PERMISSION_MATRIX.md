# WebExcels DRM — Route ↔ Permission Matrix (Stage 2)

> Generated from `client/src/routes/route-registry.ts`. **Non-authoritative**:
> access is enforced at runtime by the backend route guards (the real security
> boundary) and by `client/src/hooks/useRouteProtection.ts` (client redirect for
> unauthorized prefixes) plus the sidebar menu-permission checks. When this table
> disagrees with the runtime guards, the runtime guards win.

Total routes documented: **187**

| Path | Title | Module | Sidebar | Group / permKey | Status | Allowed roles | Notes |
|------|-------|--------|:------:|------------------|:------:|---------------|-------|
| `/auth` | Sign In | Auth | — | — | internal | any authenticated | Public auth page. |
| `/` | Dashboard | Dashboard | ✓ | Dashboard | active | any authenticated |  |
| `/dashboard` | Dashboard | Dashboard | ✓ | Dashboard | active | any authenticated |  |
| `/dashboard/account-manager` | Account Manager Dashboard | Dashboard | — | — | internal | admin, account_manager |  |
| `/dashboard/dd-executive` | D&D Executive Dashboard | Dashboard | — | — | internal | admin, dd_executive |  |
| `/dashboard/dd-manager` | D&D Manager Dashboard | Dashboard | — | — | internal | admin, dd_manager |  |
| `/dashboard/hod` | HOD Dashboard | Dashboard | — | — | internal | admin, hod, super_hod |  |
| `/dashboard/it-manager` | IT Manager Dashboard | Dashboard | — | — | internal | admin, it_manager |  |
| `/dashboard/lead-executive` | Lead Executive Dashboard | Dashboard | — | — | internal | admin, lead_executive, lead_manager, software_manager |  |
| `/dashboard/lead-manager` | Lead Manager Dashboard | Dashboard | — | — | internal | admin, lead_manager, software_manager |  |
| `/dashboard/marketing-manager` | Marketing Manager Dashboard | Dashboard | — | — | internal | admin, marketing_manager |  |
| `/dashboard/reception` | Reception Dashboard | Dashboard | — | — | internal | admin, reception_manager |  |
| `/dashboard/sales-assistant-manager` | Sales Assistant Manager Dashboard | Dashboard | — | — | internal | admin, sales_assistant_manager |  |
| `/dashboard/sales-executive` | Sales Executive Dashboard | Dashboard | — | — | internal | admin, sales_executive |  |
| `/dashboard/sales-manager` | Sales Manager Dashboard | Dashboard | — | — | internal | admin, sales_manager |  |
| `/dashboard/seo-smm` | SEO/SMM Manager Dashboard | Dashboard | — | — | internal | admin, seo_smm_manager |  |
| `/dashboard/service-assistant-manager` | Service Assistant Manager Dashboard | Dashboard | — | — | internal | admin, service_assistant_manager |  |
| `/dashboard/service-executive` | Service Executive Dashboard | Dashboard | — | — | internal | admin, service_executive |  |
| `/dashboard/service-manager` | Service Manager Dashboard | Dashboard | — | — | internal | admin, service_manager |  |
| `/dashboard/software-executive` | Software Executive Dashboard | Dashboard | — | — | internal | admin, software_executive, software_manager |  |
| `/dashboard/software-manager` | Software Manager Dashboard | Dashboard | — | — | internal | admin, software_manager |  |
| `/dashboard/super-hod` | Super HOD Dashboard | Dashboard | — | — | internal | admin, super_hod |  |
| `/dashboard/vas-system` | VAS System | Dashboard | — | — | internal | any authenticated |  |
| `/qa/manager` | QA Manager | Dashboard | — | — | internal | admin, qa_manager |  |
| `/verification/customers` | Customers Verification | Dashboard | — | — | internal | admin, verification_manager |  |
| `/verification/manager` | Verification Manager | Dashboard | — | — | internal | admin, verification_manager |  |
| `/customer/temporary-contact` | Temporary Contact | Customer | ✓ | Customer | active | all staff (menu-permission gated) | Canonical temp-contact route. |
| `/customers/private-pool` | Private Pool | Customer | ✓ | Customer | active | all staff (menu-permission gated) | Role-aware: service roles → ServicePrivatePool, else LeadPools. |
| `/customers/public-pool` | Public Pool | Customer | ✓ | Customer | active | all staff (menu-permission gated) | Role-aware: service roles → ServicePublicPool, else LeadPools. |
| `/customers/service-pool` | Service Pool | Customer | ✓ | Customer | active | all staff (menu-permission gated) |  |
| `/gm-pool/add-gm` | Add GM | Customer | ✓ | Customer | active | all staff (menu-permission gated) |  |
| `/sales/add-customer` | Add Customer | Customer | ✓ | Customer | active | all staff (menu-permission gated) |  |
| `/sales/appointments` | Appointments | Customer | — | — | internal | all staff (menu-permission gated) |  |
| `/sales/create-invoice/:customerId` | Create Invoice | Customer | — | — | dynamic | all staff (menu-permission gated) | Dynamic: validates customerId; loading / not-found states. |
| `/sales/customers` | Customer Management | Customer | ✓ | Customer | active | all staff (menu-permission gated) |  |
| `/sales/customers/a-minus` | A- Customers | Customer | — | — | internal | all staff (menu-permission gated) |  |
| `/sales/duplicate-checker` | Check Duplication | Customer | ✓ | Customer | active | all staff (menu-permission gated) |  |
| `/sales/invoice-pool` | Invoice Pool | Customer | ✓ | Customer | active | all staff (menu-permission gated) |  |
| `/sales/quotation` | Quotation | Customer | — | — | internal | all staff (menu-permission gated) |  |
| `/sales/targets` | Sales Targets | Customer | — | — | internal | all staff (menu-permission gated) |  |
| `/sales/temp-contact` | Temporary Contact (alias) | Customer | — | — | alias | all staff (menu-permission gated) | Alias → /customer/temporary-contact. |
| `/sales/tracing` | Tracking | Customer | ✓ | Customer | active | all staff (menu-permission gated) |  |
| `/sales/tracing/view/:id` | Tracking Detail | Customer | — | — | dynamic | all staff (menu-permission gated) |  |
| `/customers/gmbv-pool` | GM BV Pool | Lead | ✓ | Lead / LEAD | active | all staff (menu-permission gated) |  |
| `/sales/lead-pools` | Lead Pool | Lead | ✓ | Lead / LEAD | active | all staff (menu-permission gated) |  |
| `/hr/attendance` | Attendance | Attendance/HR | ✓ | Attendance | active | all staff (menu-permission gated) |  |
| `/hr/attendance/todo` | To Do List | Attendance/HR | ✓ | Attendance | active | all staff (menu-permission gated) |  |
| `/hr/leave-request` | Leave Request | Attendance/HR | ✓ | Attendance | active | all staff (menu-permission gated) |  |
| `/hr/loan` | Loan / Advance Salary | Attendance/HR | ✓ | Attendance | active | all staff (menu-permission gated) |  |
| `/hr/overtime` | Overtime Submission | Attendance/HR | ✓ | Attendance | active | all staff (menu-permission gated) |  |
| `/dd-manager/project-report` | Project Report (alias) | PMS | — | — | alias | all staff (menu-permission gated) | Alias → /pms/project-report. |
| `/pms/approvals` | Pending Approvals | PMS | ✓ | PMS | active | all staff (menu-permission gated) |  |
| `/pms/completed-projects` | Completed Projects | PMS | — | — | internal | all staff (menu-permission gated) |  |
| `/pms/project-report` | Project Report | PMS | ✓ | PMS | active | all staff (menu-permission gated) | Canonical project report. |
| `/pms/running-projects` | Running Projects | PMS | ✓ | PMS | active | all staff (menu-permission gated) |  |
| `/pms/status` | Project Status | PMS | ✓ | PMS | active | all staff (menu-permission gated) |  |
| `/pms/task-history` | Task History | PMS | ✓ | PMS | active | all staff (menu-permission gated) |  |
| `/pms/task-templates` | Task Templates | PMS | ✓ | PMS | active | all staff (menu-permission gated) |  |
| `/pms/tasks` | Task Creation | PMS | ✓ | PMS | active | all staff (menu-permission gated) |  |
| `/pms/team-workspace` | Team Workspace | PMS | ✓ | PMS | active | all staff (menu-permission gated) |  |
| `/projects` | Projects (alias) | PMS | — | — | alias | all staff (menu-permission gated) | Alias → /drm/delay-project. |
| `/projects/upcoming` | Upcoming Projects | PMS | — | — | internal | all staff (menu-permission gated) |  |
| `/service/a-customer` | A Customers | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/b-customer` | B Customers | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/b-minus-customer` | B- Customers | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/b-plus-customer` | B+ Customers | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/bv-checking` | BV Checking | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/bv-document-list` | BV Document List | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/complaint-list` | Complaint List | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/dropout-customer` | Dropout Customers | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/due-vas-payment` | Due VAS Payment | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/monthly-followup` | Monthly Follow-up | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/not-follow-customer` | Not-Followed Customers | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/pool` | Service Pool | Service | — | — | internal | admin, super_hod, hod, service_manager, service_assistant_manager, service_executive |  |
| `/service/public-pool` | Service Public Pool | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/todo-list` | Service To-Do | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/vas-document-list` | VAS Document List | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/service/weekly-dropout` | Weekly Dropout | Service | — | — | internal | admin, service_manager, service_assistant_manager, service_executive |  |
| `/posting-data` | Posting Data | Product Posting | — | — | internal | admin, product_posting_manager, product_posting_executive, posting_executive |  |
| `/posting-data/add-keywords` | Add Keywords | Product Posting | ✓ | Posting Data | active | admin, product_posting_manager, product_posting_executive, posting_executive |  |
| `/posting-data/add-products` | Add Products | Product Posting | ✓ | Posting Data | active | admin, product_posting_manager, product_posting_executive, posting_executive |  |
| `/posting-data/data-verify` | Data Verify | Product Posting | ✓ | Posting Data | active | admin, product_posting_manager, product_posting_executive, posting_executive |  |
| `/posting-data/keywords` | Keywords | Product Posting | — | — | internal | admin, product_posting_manager, product_posting_executive, posting_executive |  |
| `/posting-data/restricted-keywords` | Restricted Keywords | Product Posting | ✓ | Posting Data | active | admin, product_posting_manager, product_posting_executive, posting_executive |  |
| `/posting-data/verified` | Verified | Product Posting | — | — | internal | admin, product_posting_manager, product_posting_executive, posting_executive |  |
| `/posting-data/view-keywords` | View Keywords | Product Posting | ✓ | Posting Data | active | admin, product_posting_manager, product_posting_executive, posting_executive |  |
| `/posting-data/view-products` | View Products | Product Posting | ✓ | Posting Data | active | admin, product_posting_manager, product_posting_executive, posting_executive |  |
| `/product-posting` | Product Posting | Product Posting | — | — | internal | admin, product_posting_manager, product_posting_executive, posting_executive | Canonical role-aware product-posting entry. |
| `/product-posting/executive` | Product Posting (Executive) | Product Posting | — | — | internal | admin, product_posting_manager, product_posting_executive, posting_executive | Role-specific entry to the shared ProductPostingDashboard; targeted by the top-bar role switcher. Intentionally kept (not merged). |
| `/product-posting/manager` | Product Posting (Manager) | Product Posting | — | — | internal | admin, product_posting_manager, product_posting_executive, posting_executive | Role-specific entry to the shared ProductPostingDashboard; targeted by the top-bar role switcher. Intentionally kept (not merged). |
| `/drm/add-penalty` | Add Penalty | DRM/DD | ✓ | Add Penalty | active | admin, super_admin, super_hod, hod, hr, hr_manager, dd_manager, product_posting_manager, software_manager |  |
| `/drm/all-social-accounts` | All Social Accounts | DRM/DD | — | — | internal | admin, super_admin, administrator, super_hod |  |
| `/drm/attributes` | Attributes | DRM/DD | ✓ | DRM Setting | active | admin, super_admin, administrator, super_hod |  |
| `/drm/bot-system` | Bot System | DRM/DD | ✓ | DRM Setting | active | admin, super_admin, administrator, super_hod |  |
| `/drm/commission-verification` | Commission Verification | DRM/DD | — | — | internal | admin, super_admin, administrator, super_hod |  |
| `/drm/delay-project` | Delay Project | DRM/DD | ✓ | DRM Setting | active | admin, super_admin, administrator, super_hod | Canonical delay-project route. |
| `/drm/delay-projects-new` | Delay Projects (New) | DRM/DD | — | — | internal | admin, super_admin, administrator, super_hod |  |
| `/drm/fb-post` | FB Post | DRM/DD | ✓ | DRM Setting | active | admin, super_admin, administrator, super_hod |  |
| `/drm/increment` | Increment | DRM/DD | ✓ | Increment | active | admin, super_admin, super_hod, hod, manager |  |
| `/drm/late-coming` | Late Coming | DRM/DD | — | — | internal | admin, super_admin, administrator, super_hod |  |
| `/drm/monthly-complete-project` | Monthly Complete Project | DRM/DD | — | — | internal | admin, super_admin, administrator, super_hod |  |
| `/drm/online-form` | Online Form | DRM/DD | ✓ | DRM Setting | active | admin, super_admin, administrator, super_hod |  |
| `/drm/overall-report` | Overall Report | DRM/DD | — | — | internal | admin, super_admin, administrator, super_hod |  |
| `/drm/performance` | Performance | DRM/DD | — | — | internal | admin, super_admin, administrator, super_hod |  |
| `/drm/permission` | DRM Permission | DRM/DD | ✓ | DRM Setting | active | admin, super_admin, administrator, super_hod |  |
| `/drm/pms-setting` | PMS Project Setting | DRM/DD | ✓ | DRM Setting | active | admin, super_admin, administrator, super_hod | Canonical PMS settings route. |
| `/drm/promotion` | Promotion | DRM/DD | ✓ | DRM Setting | active | admin, super_admin, administrator, super_hod |  |
| `/drm/related-customer` | Related Customer | DRM/DD | ✓ | DRM Setting | active | admin, super_admin, administrator, super_hod |  |
| `/drm/today-post` | Today Post | DRM/DD | — | — | internal | admin, super_admin, administrator, super_hod |  |
| `/pms/settings` | PMS Settings (alias) | DRM/DD | — | — | alias | admin, super_admin, administrator, super_hod | Pre-existing alias → /drm/pms-setting. |
| `/account/ab-report` | AB Report | Accounts | ✓ | Account | active | all staff (menu-permission gated) |  |
| `/account/dollar-system` | Dollar System | Accounts | ✓ | Account | active | all staff (menu-permission gated) |  |
| `/account/donations` | Donations | Accounts | ✓ | Account | active | all staff (menu-permission gated) |  |
| `/account/gm-entries` | Create GM | Accounts | ✓ | Account | active | all staff (menu-permission gated) | Canonical GM entries route. |
| `/account/invoices` | Make Invoice | Accounts | ✓ | Account | active | all staff (menu-permission gated) |  |
| `/account/ledger` | Company Ledger | Accounts | ✓ | Account | active | all staff (menu-permission gated) |  |
| `/account/refund-gm` | Add Refund GM | Accounts | ✓ | Account | active | all staff (menu-permission gated) |  |
| `/account/temp-gm` | Add Temp GM | Accounts | ✓ | Account | active | all staff (menu-permission gated) |  |
| `/office/account-head` | Account Head | Office Accounts | — | — | internal | all staff (menu-permission gated) | Sidebar entry commented out; route retained for direct/legacy access. |
| `/office/business-customers` | Business Customer | Office Accounts | ✓ | Office Account | active | all staff (menu-permission gated) |  |
| `/office/chart-of-accounts` | Chart of Account | Office Accounts | ✓ | Office Account | active | all staff (menu-permission gated) | Canonical chart-of-accounts route (single declaration). |
| `/office/cheques` | Cheque System | Office Accounts | ✓ | Office Account | active | all staff (menu-permission gated) |  |
| `/office/expenses` | Office Expense | Office Accounts | ✓ | Office Account | active | all staff (menu-permission gated) |  |
| `/office/old-account-head` | Old Account Head | Office Accounts | ✓ | Office Account | active | all staff (menu-permission gated) |  |
| `/office/trial-balance-report` | Trial Balance Report | Office Accounts | ✓ | Office Account | active | all staff (menu-permission gated) |  |
| `/office/vas` | Office Vas | Office Accounts | ✓ | Office Account | active | all staff (menu-permission gated) |  |
| `/office/vas-documents` | VAS Documents | Office Accounts | — | — | internal | all staff (menu-permission gated) |  |
| `/daily-reports/added-gm` | Daily Added GM Report | Reports | ✓ | Daily Reports | active | admin, super_admin, administrator, super_hod |  |
| `/posting-data/link-report` | Link Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) | Canonical link report (also in Posting Data group). |
| `/reports` | Reports | Reports | — | — | internal | all staff (menu-permission gated) |  |
| `/reports/:type` | Report | Reports | — | — | dynamic | all staff (menu-permission gated) | Catch-all; resolves sidebar shortcuts /reports/{loan,vas,gm,bv}. |
| `/reports/attendance` | Attendance Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/bv-pending-ecnc` | BV Pending EC/NC Only | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/bv-pending-rc` | BV Pending RC Only | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/bv/new` | New BV Report | Reports | — | — | internal | all staff (menu-permission gated) |  |
| `/reports/day-target` | Day Target Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/department` | Department Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/diagnose` | Diagnose Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/edit-att` | Edit Attendance | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/event` | Event Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/follow-up` | Follow Up Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/gm/new` | New GM Report | Reports | — | — | internal | all staff (menu-permission gated) |  |
| `/reports/in-service` | In Service Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/loan/:id/edit` | Edit Loan Report | Reports | — | — | dynamic | all staff (menu-permission gated) | Dynamic: validates id; loading / not-found states. |
| `/reports/loan/new` | New Loan Report | Reports | — | — | internal | all staff (menu-permission gated) |  |
| `/reports/projects` | Projects Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/raw-attendance` | Raw Attendance | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/reception` | Reception Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/salary` | Salary Report | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/salary-create` | Salary Create | Reports | ✓ | Reports / Report | active | all staff (menu-permission gated) |  |
| `/reports/vas/new` | New VAS Report | Reports | — | — | internal | all staff (menu-permission gated) |  |
| `/team-report/link-report` | Link Report (alias) | Reports | — | — | alias | all staff (menu-permission gated) | Alias → /posting-data/link-report. |
| `/analytics/gm` | GM Report | Analytics | ✓ | Reports / Report | active | admin, super_hod, hod, sales_manager, account_manager |  |
| `/analytics/invoice` | Invoice Report | Analytics | — | — | internal | admin, super_hod, hod, account_manager |  |
| `/analytics/ledger` | Ledger Report | Analytics | — | — | internal | admin, super_hod, hod, account_manager |  |
| `/analytics/refund` | Refund Report | Analytics | — | — | internal | admin, super_hod, hod, account_manager |  |
| `/analytics/user-activity` | User Activity | Analytics | — | — | internal | admin, super_hod, hod |  |
| `/support/complaints` | Complaints | Support | — | — | internal | admin, super_hod, hod, support_agent |  |
| `/support/tickets` | Tickets | Support | ✓ | Support | active | admin, super_hod, hod, software_manager, software_executive, lead_manager, lead_executive, marketing_manager |  |
| `/support/tickets/:id` | Ticket Detail | Support | — | — | dynamic | admin, super_hod, hod, software_manager, software_executive, lead_manager, lead_executive, marketing_manager | Dynamic: validates id; loading / not-found states. |
| `/training` | Training | Training | ✓ | Training | active | all staff (menu-permission gated) |  |
| `/training/:category` | Training Category | Training | — | — | dynamic | all staff (menu-permission gated) | Category param; unknown categories fall back within TrainingCenter. |
| `/events/add` | Add Event | Events | ✓ | Events | active | admin, hod, super_hod, marketing_manager |  |
| `/events/duty-planner` | Event Duty Planner | Events | ✓ | Events | active | admin, hod, super_hod, marketing_manager |  |
| `/events/menu` | Add Event Menu | Events | ✓ | Events | active | admin, hod, super_hod, marketing_manager |  |
| `/target-system/add-kwa` | Add KWA | Target System | ✓ | Target System | active | admin, sales_manager, hod, super_hod |  |
| `/target-system/create` | Create Target | Target System | ✓ | Target System | active | admin, sales_manager, hod, super_hod |  |
| `/target-system/daily` | Daily Target | Target System | ✓ | Target System | active | admin, sales_manager, hod, super_hod |  |
| `/target-system/kwa-history` | KWA History | Target System | ✓ | Target System | active | admin, sales_manager, hod, super_hod |  |
| `/target-system/set` | Set Target | Target System | ✓ | Target System | active | admin, sales_manager, hod, super_hod |  |
| `/target-system/view` | View Target | Target System | ✓ | Target System | active | admin, sales_manager, hod, super_hod |  |
| `/it/backup` | Backup | IT/Domain | ✓ | Domain Hosting | active | admin, it_manager, developer |  |
| `/it/domains` | Domains | IT/Domain | ✓ | Domain Hosting | active | admin, it_manager, developer |  |
| `/it/servers` | Servers | IT/Domain | ✓ | Domain Hosting | active | admin, it_manager, developer |  |
| `/it/system-report` | System Report | IT/Domain | — | — | internal | admin, it_manager, developer |  |
| `/portfolio-add` | Add Portfolio | Portfolio | ✓ | Portfolio | active | admin, verification_manager, hod, super_hod |  |
| `/portfolio-view` | View Portfolio | Portfolio | ✓ | Portfolio | active | admin, verification_manager, hod, super_hod |  |
| `/admin` | Admin | Settings | ✓ | DRM Setting / Admin | active | admin, super_admin, administrator, super_hod |  |
| `/allowed-ip/drm-ip-list` | DRM IP List | Settings | ✓ | Allowed IP | active | admin, super_admin, administrator, super_hod |  |
| `/super-admin` | Super Admin | Settings | ✓ | DRM Setting / Admin | active | admin, super_admin, administrator, super_hod |  |
| `/drm/users/add` | Add User | Users | ✓ | Users | active | admin, super_admin, administrator, super_hod |  |
| `/drm/users/groups` | User Groups | Users | ✓ | Users | active | admin, super_admin, administrator, super_hod |  |
| `/drm/users/list` | User List | Users | ✓ | Users | active | admin, super_admin, administrator, super_hod |  |
| `/notice-board` | Notice Board | Notice | ✓ | Notice / Notice Board | active | admin, super_hod, reception_manager |  |
| `/policies` | DRM Policies | Notice | ✓ | Notice / DRM Policies | active | admin, super_hod, reception_manager |  |
| `/social-media` | Social Media Posting | Social Media | ✓ | Social Media Posting | active | admin, hod, super_hod, marketing_manager |  |
| `/workspace` | Workspace | Misc | — | — | internal | all staff (menu-permission gated) |  |

## Alias / redirect summary

| Alias | Canonical |
|-------|-----------|
| `/sales/temp-contact` | `/customer/temporary-contact` |
| `/dd-manager/project-report` | `/pms/project-report` |
| `/projects` | `/drm/delay-project` |
| `/pms/settings` | `/drm/pms-setting` |
| `/team-report/link-report` | `/posting-data/link-report` |

