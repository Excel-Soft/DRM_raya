// ---------------------------------------------------------------------------
// Route registry (Stage 2)
//
// A typed, central inventory of the application's routes. This is the source of
// truth for *documentation and alignment* between `client/src/App.tsx`
// (the wouter <Switch>), the sidebar (`app-sidebar.tsx`), and route protection
// (`useRouteProtection.ts`).
//
// IMPORTANT: this registry is intentionally NON-AUTHORITATIVE for enforcement.
// Access is still enforced at runtime by:
//   - the backend per-route guards (the real security boundary), and
//   - `useRouteProtection` (client-side redirect for unauthorized prefixes).
// The `allowedRoles` / `permissionKey` fields here MIRROR that configuration so
// the navigation surface can be reasoned about and audited in one place. When
// they disagree with the runtime guards, the runtime guards win.
//
// Incremental adoption: App.tsx still declares routes directly. This registry is
// consumed today for breadcrumbs (`getBreadcrumbsForPath`) and the permission
// matrix, and can be wired more deeply over time without a risky rewrite.
// ---------------------------------------------------------------------------

export type RouteModule =
  | "Auth"
  | "Dashboard"
  | "Customer"
  | "Lead"
  | "Attendance/HR"
  | "PMS"
  | "Service"
  | "Product Posting"
  | "DRM/DD"
  | "Accounts"
  | "Office Accounts"
  | "Reports"
  | "Analytics"
  | "Support"
  | "Training"
  | "Events"
  | "Target System"
  | "IT/Domain"
  | "Portfolio"
  | "Settings"
  | "Users"
  | "Notice"
  | "Social Media"
  | "Misc";

export type RouteStatus =
  | "active" // normal, reachable page
  | "internal" // reachable but not surfaced in the sidebar (dashboards, detail views)
  | "dynamic" // has a path parameter (e.g. :id)
  | "alias" // redirects to a canonical route
  | "deprecated"; // kept for backwards-compat, slated for removal

export interface RouteEntry {
  /** wouter path pattern, e.g. "/support/tickets/:id" */
  path: string;
  /** Component name as declared in App.tsx (documentation only). */
  component: string;
  /** Human-friendly page/title for breadcrumbs and the matrix. */
  title: string;
  /** Logical module this route belongs to. */
  module: RouteModule;
  /** Whether a sidebar entry points at this route. */
  sidebarVisible: boolean;
  /** Sidebar top-level group label, when sidebarVisible. */
  sidebarGroup?: string;
  /** Sidebar permKey / backend menu permission name, when applicable. */
  permissionKey?: string;
  /**
   * Roles permitted to reach the route. Mirrors `useRouteProtection`
   * ROUTE_PERMISSIONS and the sidebar role map. `"*"` means any authenticated
   * user (no prefix rule); `"inherit"` means it follows the protected prefix.
   */
  allowedRoles: string[] | "*" | "inherit";
  /** True when the path has a parameter segment. */
  isDynamic?: boolean;
  /** True when reachable but intentionally not in the sidebar. */
  isInternal?: boolean;
  /** Canonical path this entry redirects to (alias/deprecated only). */
  redirectTo?: string;
  /** Free-form notes (deprecation reason, role-entry semantics, etc.). */
  notes?: string;
}

// ---------------------------------------------------------------------------
// Role groups — mirror of client/src/hooks/useRouteProtection.ts
// (kept here for documentation/matrix generation; that hook stays the runtime
// source of truth for client-side redirects).
// ---------------------------------------------------------------------------
const ALL_STAFF = "inherit" as const;
const ADMIN_ONLY = ["admin", "super_admin", "administrator", "super_hod"];
const POSTING = ["admin", "product_posting_manager", "product_posting_executive", "posting_executive"];

export const routeRegistry: RouteEntry[] = [
  // ── Auth ──────────────────────────────────────────────────────────────
  { path: "/auth", component: "AuthPage", title: "Sign In", module: "Auth", sidebarVisible: false, allowedRoles: "*", isInternal: true, notes: "Public auth page." },

  // ── Dashboards ────────────────────────────────────────────────────────
  { path: "/", component: "Dashboard", title: "Dashboard", module: "Dashboard", sidebarVisible: true, sidebarGroup: "Dashboard", permissionKey: "Dashboard", allowedRoles: "*" },
  { path: "/dashboard", component: "Dashboard", title: "Dashboard", module: "Dashboard", sidebarVisible: true, sidebarGroup: "Dashboard", permissionKey: "Dashboard", allowedRoles: "*" },
  { path: "/dashboard/hod", component: "HodDashboard", title: "HOD Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "hod", "super_hod"] },
  { path: "/dashboard/super-hod", component: "SuperHODDashboard", title: "Super HOD Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "super_hod"] },
  { path: "/dashboard/sales-manager", component: "SalesManagerDashboard", title: "Sales Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "sales_manager"] },
  { path: "/dashboard/sales-assistant-manager", component: "SalesAssistantManagerDashboard", title: "Sales Assistant Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "sales_assistant_manager"] },
  { path: "/dashboard/account-manager", component: "AccountManagerDashboard", title: "Account Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "account_manager"] },
  { path: "/dashboard/sales-executive", component: "SalesExecutiveDashboard", title: "Sales Executive Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "sales_executive"] },
  { path: "/dashboard/dd-manager", component: "DDManagerDashboard", title: "D&D Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "dd_manager"] },
  { path: "/dashboard/dd-executive", component: "DDExecutiveDashboard", title: "D&D Executive Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "dd_executive"] },
  { path: "/dashboard/it-manager", component: "ItManagerDashboard", title: "IT Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "it_manager"] },
  { path: "/dashboard/service-manager", component: "ServiceManagerDashboard", title: "Service Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager"] },
  { path: "/dashboard/service-assistant-manager", component: "ServiceAssistantManagerDashboard", title: "Service Assistant Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_assistant_manager"] },
  { path: "/dashboard/service-executive", component: "ServiceExecutiveDashboard", title: "Service Executive Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_executive"] },
  { path: "/dashboard/vas-system", component: "VasSystem", title: "VAS System", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: "*" },
  { path: "/dashboard/reception", component: "ReceptionDashboard", title: "Reception Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "reception_manager"] },
  { path: "/dashboard/seo-smm", component: "SeoSmmManagerDashboard", title: "SEO/SMM Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "seo_smm_manager"] },
  { path: "/dashboard/lead-manager", component: "LeadManagerDashboard", title: "Lead Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "lead_manager", "software_manager"] },
  { path: "/dashboard/lead-executive", component: "LeadExecutiveDashboard", title: "Lead Executive Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "lead_executive", "lead_manager", "software_manager"] },
  { path: "/dashboard/software-manager", component: "SoftwareManagerDashboard", title: "Software Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "software_manager"] },
  { path: "/dashboard/software-executive", component: "SoftwareExecutiveDashboard", title: "Software Executive Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "software_executive", "software_manager"] },
  { path: "/dashboard/marketing-manager", component: "MarketingManagerDashboard", title: "Marketing Manager Dashboard", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "marketing_manager"] },
  { path: "/product-posting", component: "ProductPostingDashboard", title: "Product Posting", module: "Product Posting", sidebarVisible: false, isInternal: true, allowedRoles: POSTING, notes: "Canonical role-aware product-posting entry." },
  { path: "/product-posting/manager", component: "ProductPostingDashboard", title: "Product Posting (Manager)", module: "Product Posting", sidebarVisible: false, isInternal: true, allowedRoles: POSTING, notes: "Role-specific entry to the shared ProductPostingDashboard; targeted by the top-bar role switcher. Intentionally kept (not merged)." },
  { path: "/product-posting/executive", component: "ProductPostingDashboard", title: "Product Posting (Executive)", module: "Product Posting", sidebarVisible: false, isInternal: true, allowedRoles: POSTING, notes: "Role-specific entry to the shared ProductPostingDashboard; targeted by the top-bar role switcher. Intentionally kept (not merged)." },
  { path: "/qa/manager", component: "QAManagerDashboard", title: "QA Manager", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "qa_manager"] },
  { path: "/verification/manager", component: "VerificationManagerDashboard", title: "Verification Manager", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "verification_manager"] },
  { path: "/verification/customers", component: "CustomersVerification", title: "Customers Verification", module: "Dashboard", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "verification_manager"] },

  // ── Customer / Sales ──────────────────────────────────────────────────
  { path: "/sales/customers", component: "CustomerManagement", title: "Customer Management", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF },
  { path: "/sales/duplicate-checker", component: "DuplicateChecker", title: "Check Duplication", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF },
  { path: "/sales/add-customer", component: "AddCustomer", title: "Add Customer", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF },
  { path: "/customer/temporary-contact", component: "TempContact", title: "Temporary Contact", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF, notes: "Canonical temp-contact route." },
  { path: "/sales/temp-contact", component: "TempContact", title: "Temporary Contact (alias)", module: "Customer", sidebarVisible: false, allowedRoles: ALL_STAFF, redirectTo: "/customer/temporary-contact", notes: "Alias → /customer/temporary-contact." },
  { path: "/gm-pool/add-gm", component: "GmPoolAddGm", title: "Add GM", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF },
  { path: "/customers/private-pool", component: "DynamicPrivatePool", title: "Private Pool", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF, notes: "Role-aware: service roles → ServicePrivatePool, else LeadPools." },
  { path: "/customers/service-pool", component: "ServicePool", title: "Service Pool", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF },
  { path: "/customers/public-pool", component: "DynamicPublicPool", title: "Public Pool", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF, notes: "Role-aware: service roles → ServicePublicPool, else LeadPools." },
  { path: "/customers/public-pool-followup", component: "PublicPoolFollowup", title: "Public Pool (Follow up)", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF },
  { path: "/sales/tracing", component: "TracingPage", title: "Tracking", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF },
  { path: "/sales/tracing/view/:id", component: "TracingViewPage", title: "Tracking Detail", module: "Customer", sidebarVisible: false, isDynamic: true, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/customers/attribute/:id", component: "CustomerAttributePage", title: "Customer Attribute", module: "Customer", sidebarVisible: false, isDynamic: true, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/sales/invoice-pool", component: "InvoicePool", title: "Invoice Pool", module: "Customer", sidebarVisible: true, sidebarGroup: "Customer", permissionKey: "Customer", allowedRoles: ALL_STAFF },
  { path: "/sales/appointments", component: "AppointmentsPage", title: "Appointments", module: "Customer", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/sales/targets", component: "SalesTargets", title: "Sales Targets", module: "Customer", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/sales/customers/a-minus", component: "AMinusCustomersPage", title: "A- Customers", module: "Customer", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/sales/quotation", component: "QuotationPage", title: "Quotation", module: "Customer", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/sales/create-invoice/:customerId", component: "CreateInvoice", title: "Create Invoice", module: "Customer", sidebarVisible: false, isDynamic: true, isInternal: true, allowedRoles: ALL_STAFF, notes: "Dynamic: validates customerId; loading / not-found states." },
  { path: "/social-media", component: "SocialMedia", title: "Social Media Posting", module: "Social Media", sidebarVisible: true, sidebarGroup: "Social Media Posting", permissionKey: "Social Media Posting", allowedRoles: ["admin", "hod", "super_hod", "marketing_manager"] },

  // ── Lead ──────────────────────────────────────────────────────────────
  { path: "/sales/lead-pools", component: "LeadPools", title: "Lead Pool", module: "Lead", sidebarVisible: true, sidebarGroup: "Lead", permissionKey: "LEAD", allowedRoles: ALL_STAFF },
  { path: "/customers/gmbv-pool", component: "LeadPools", title: "GM BV Pool", module: "Lead", sidebarVisible: true, sidebarGroup: "Lead", permissionKey: "LEAD", allowedRoles: ALL_STAFF },

  // ── Attendance / HR ───────────────────────────────────────────────────
  { path: "/hr/attendance", component: "AttendanceManagement", title: "Attendance", module: "Attendance/HR", sidebarVisible: true, sidebarGroup: "Attendance", permissionKey: "Attendance", allowedRoles: ALL_STAFF },
  { path: "/hr/attendance/todo", component: "AttendanceTodo", title: "To Do List", module: "Attendance/HR", sidebarVisible: true, sidebarGroup: "Attendance", permissionKey: "Attendance", allowedRoles: ALL_STAFF },
  { path: "/hr/leave-request", component: "LeaveRequest", title: "Leave Request", module: "Attendance/HR", sidebarVisible: true, sidebarGroup: "Attendance", permissionKey: "Attendance", allowedRoles: ALL_STAFF },
  { path: "/hr/overtime", component: "OvertimeSubmission", title: "Overtime Submission", module: "Attendance/HR", sidebarVisible: true, sidebarGroup: "Attendance", permissionKey: "Attendance", allowedRoles: ALL_STAFF },
  { path: "/hr/loan", component: "LoanRequest", title: "Loan / Advance Salary", module: "Attendance/HR", sidebarVisible: true, sidebarGroup: "Attendance", permissionKey: "Attendance", allowedRoles: ALL_STAFF },

  // ── PMS ───────────────────────────────────────────────────────────────
  { path: "/pms/task-templates", component: "PmsTaskTemplates", title: "Task Templates", module: "PMS", sidebarVisible: true, sidebarGroup: "PMS", permissionKey: "PMS", allowedRoles: ALL_STAFF },
  { path: "/pms/tasks", component: "PmsTasks", title: "Task Creation", module: "PMS", sidebarVisible: true, sidebarGroup: "PMS", permissionKey: "PMS", allowedRoles: ALL_STAFF },
  { path: "/pms/status", component: "PmsStatus", title: "Project Status", module: "PMS", sidebarVisible: true, sidebarGroup: "PMS", permissionKey: "PMS", allowedRoles: ALL_STAFF },
  { path: "/pms/running-projects", component: "PmsRunningProjects", title: "Running Projects", module: "PMS", sidebarVisible: true, sidebarGroup: "PMS", permissionKey: "PMS", allowedRoles: ALL_STAFF },
  { path: "/pms/approvals", component: "PmsPendingApprovals", title: "Pending Approvals", module: "PMS", sidebarVisible: true, sidebarGroup: "PMS", permissionKey: "PMS", allowedRoles: ALL_STAFF },
  { path: "/pms/task-history", component: "PmsTaskHistory", title: "Task History", module: "PMS", sidebarVisible: true, sidebarGroup: "PMS", permissionKey: "PMS", allowedRoles: ALL_STAFF },
  { path: "/pms/team-workspace", component: "PmsTeamWorkspace", title: "Team Workspace", module: "PMS", sidebarVisible: true, sidebarGroup: "PMS", permissionKey: "PMS", allowedRoles: ALL_STAFF },
  { path: "/pms/project-report", component: "PmsProjectReport", title: "Project Report", module: "PMS", sidebarVisible: true, sidebarGroup: "PMS", permissionKey: "PMS", allowedRoles: ALL_STAFF, notes: "Canonical project report." },
  { path: "/dd-manager/project-report", component: "PmsProjectReport", title: "Project Report (alias)", module: "PMS", sidebarVisible: false, allowedRoles: ALL_STAFF, redirectTo: "/pms/project-report", notes: "Alias → /pms/project-report." },
  { path: "/pms/completed-projects", component: "PmsCompletedProjects", title: "Completed Projects", module: "PMS", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/projects", component: "DelayProjectPage", title: "Projects (alias)", module: "PMS", sidebarVisible: false, allowedRoles: ALL_STAFF, redirectTo: "/drm/delay-project", notes: "Alias → /drm/delay-project." },
  { path: "/projects/upcoming", component: "UpcomingProjectPage", title: "Upcoming Projects", module: "PMS", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },

  // ── Service ───────────────────────────────────────────────────────────
  { path: "/service/pool", component: "ServicePoolDashboard", title: "Service Pool", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "super_hod", "hod", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/bv-checking", component: "ServiceBvChecking", title: "BV Checking", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/public-pool", component: "ServicePublicPool", title: "Service Public Pool", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/a-customer", component: "ServiceACustomer", title: "A Customers", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/b-plus-customer", component: "ServiceBPlusCustomer", title: "B+ Customers", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/b-customer", component: "ServiceBCustomer", title: "B Customers", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/b-minus-customer", component: "ServiceBMinusCustomer", title: "B- Customers", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/monthly-followup", component: "ServiceMonthlyFollowup", title: "Monthly Follow-up", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/weekly-dropout", component: "ServiceWeeklyDropout", title: "Weekly Dropout", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/dropout-customer", component: "ServiceDropoutCustomer", title: "Dropout Customers", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/complaint-list", component: "ServiceComplaintList", title: "Complaint List", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/not-follow-customer", component: "ServiceNotFollowCustomer", title: "Not-Followed Customers", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/bv-document-list", component: "ServiceBvDocumentList", title: "BV Document List", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/vas-document-list", component: "ServiceVasDocumentList", title: "VAS Document List", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/due-vas-payment", component: "ServiceDueVasPayment", title: "Due VAS Payment", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },
  { path: "/service/todo-list", component: "ServiceTodoList", title: "Service To-Do", module: "Service", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "service_manager", "service_assistant_manager", "service_executive"] },

  // ── DRM / DD ──────────────────────────────────────────────────────────
  { path: "/drm/attributes", component: "AttributesPage", title: "Attributes", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "DRM Setting", allowedRoles: ADMIN_ONLY },
  { path: "/drm/permission", component: "PermissionPage", title: "DRM Permission", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "DRM Setting", allowedRoles: ADMIN_ONLY },
  { path: "/drm/promotion", component: "PromotionPage", title: "Promotion", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "DRM Setting", allowedRoles: ADMIN_ONLY },
  { path: "/drm/delay-project", component: "DelayProjectPage", title: "Delay Project", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "DRM Setting", allowedRoles: ADMIN_ONLY, notes: "Canonical delay-project route." },
  { path: "/drm/delay-projects-new", component: "DelayProjectsNewPage", title: "Delay Projects (New)", module: "DRM/DD", sidebarVisible: false, isInternal: true, allowedRoles: ADMIN_ONLY },
  { path: "/drm/related-customer", component: "RelatedCustomerPage", title: "Related Customer", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "DRM Setting", allowedRoles: ADMIN_ONLY },
  { path: "/drm/pms-setting", component: "PmsSettingPage", title: "PMS Project Setting", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "DRM Setting", allowedRoles: ADMIN_ONLY, notes: "Canonical PMS settings route." },
  { path: "/pms/settings", component: "Redirect", title: "PMS Settings (alias)", module: "DRM/DD", sidebarVisible: false, allowedRoles: ADMIN_ONLY, redirectTo: "/drm/pms-setting", notes: "Pre-existing alias → /drm/pms-setting." },
  { path: "/drm/bot-system", component: "BotSystem", title: "Bot System", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "DRM Setting", allowedRoles: ADMIN_ONLY },
  { path: "/drm/online-form", component: "OnlineForm", title: "Online Form", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "DRM Setting", allowedRoles: ADMIN_ONLY },
  { path: "/drm/fb-post", component: "FbPost", title: "FB Post", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "DRM Setting", allowedRoles: ADMIN_ONLY },
  { path: "/drm/monthly-complete-project", component: "MonthlyCompleteProject", title: "Monthly Complete Project", module: "DRM/DD", sidebarVisible: false, isInternal: true, allowedRoles: ADMIN_ONLY },
  { path: "/drm/overall-report", component: "OverallReportPage", title: "Overall Report", module: "DRM/DD", sidebarVisible: false, isInternal: true, allowedRoles: ADMIN_ONLY },
  { path: "/drm/today-post", component: "TodayPostPage", title: "Today Post", module: "DRM/DD", sidebarVisible: false, isInternal: true, allowedRoles: ADMIN_ONLY },
  { path: "/drm/add-penalty", component: "AddPenaltyPage", title: "Add Penalty", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "Add Penalty", permissionKey: "Add Penalty", allowedRoles: ["admin", "super_admin", "super_hod", "hod", "hr", "hr_manager", "dd_manager", "product_posting_manager", "software_manager"] },
  { path: "/drm/commission-verification", component: "CommissionVerificationPage", title: "Commission Verification", module: "DRM/DD", sidebarVisible: false, isInternal: true, allowedRoles: ADMIN_ONLY },
  { path: "/drm/all-social-accounts", component: "AllSocialAccountsPage", title: "All Social Accounts", module: "DRM/DD", sidebarVisible: false, isInternal: true, allowedRoles: ADMIN_ONLY },
  { path: "/drm/increment", component: "IncrementPage", title: "Increment", module: "DRM/DD", sidebarVisible: true, sidebarGroup: "Increment", permissionKey: "Increment", allowedRoles: ["admin", "super_admin", "super_hod", "hod", "manager"] },
  { path: "/drm/performance", component: "PerformancePage", title: "Performance", module: "DRM/DD", sidebarVisible: false, isInternal: true, allowedRoles: ADMIN_ONLY },
  { path: "/drm/late-coming", component: "LateComingPage", title: "Late Coming", module: "DRM/DD", sidebarVisible: false, isInternal: true, allowedRoles: ADMIN_ONLY },

  // ── Accounts ──────────────────────────────────────────────────────────
  { path: "/account/gm-entries", component: "AccountGmEntries", title: "Create GM", module: "Accounts", sidebarVisible: true, sidebarGroup: "Account", permissionKey: "Account", allowedRoles: ALL_STAFF, notes: "Canonical GM entries route." },
  { path: "/account/temp-gm", component: "AccountTempGm", title: "Add Temp GM", module: "Accounts", sidebarVisible: true, sidebarGroup: "Account", permissionKey: "Account", allowedRoles: ALL_STAFF },
  { path: "/account/refund-gm", component: "AccountRefundGm", title: "Add Refund GM", module: "Accounts", sidebarVisible: true, sidebarGroup: "Account", permissionKey: "Account", allowedRoles: ALL_STAFF },
  { path: "/account/donations", component: "AccountDonations", title: "Donations", module: "Accounts", sidebarVisible: true, sidebarGroup: "Account", permissionKey: "Account", allowedRoles: ALL_STAFF },
  { path: "/account/invoices", component: "AccountInvoices", title: "Make Invoice", module: "Accounts", sidebarVisible: true, sidebarGroup: "Account", permissionKey: "Account", allowedRoles: ALL_STAFF },
  { path: "/account/ledger", component: "AccountLedger", title: "Company Ledger", module: "Accounts", sidebarVisible: true, sidebarGroup: "Account", permissionKey: "Account", allowedRoles: ALL_STAFF },
  { path: "/account/ab-report", component: "AbReport", title: "AB Report", module: "Accounts", sidebarVisible: true, sidebarGroup: "Account", permissionKey: "Account", allowedRoles: ALL_STAFF },
  { path: "/account/dollar-system", component: "DollarSystem", title: "Dollar System", module: "Accounts", sidebarVisible: true, sidebarGroup: "Account", permissionKey: "Account", allowedRoles: ALL_STAFF },

  // ── Office Accounts ───────────────────────────────────────────────────
  { path: "/office/trial-balance-report", component: "OfficeTrialBalance", title: "Trial Balance Report", module: "Office Accounts", sidebarVisible: true, sidebarGroup: "Office Account", permissionKey: "Office Account", allowedRoles: ALL_STAFF },
  { path: "/office/old-account-head", component: "OfficeOldAccountHead", title: "Old Account Head", module: "Office Accounts", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF, notes: "Deprecated route; redirects to /office/chart-of-accounts." },
  { path: "/office/chart-of-accounts", component: "ChartOfAccounts", title: "Chart of Account", module: "Office Accounts", sidebarVisible: true, sidebarGroup: "Office Account", permissionKey: "Office Account", allowedRoles: ALL_STAFF, notes: "Canonical chart-of-accounts route (single declaration)." },
  { path: "/office/account-head", component: "OfficeAccountHead", title: "Account Head", module: "Office Accounts", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF, notes: "Deprecated route; redirects to /office/chart-of-accounts." },
  { path: "/office/business-customers", component: "BusinessCustomers", title: "Business Customer", module: "Office Accounts", sidebarVisible: true, sidebarGroup: "Office Account", permissionKey: "Office Account", allowedRoles: ALL_STAFF },
  { path: "/office/vas", component: "OfficeVasPage", title: "Office Vas", module: "Office Accounts", sidebarVisible: true, sidebarGroup: "Office Account", permissionKey: "Office Account", allowedRoles: ALL_STAFF },
  { path: "/office/expenses", component: "OfficeExpenses", title: "Office Expense", module: "Office Accounts", sidebarVisible: true, sidebarGroup: "Office Account", permissionKey: "Office Account", allowedRoles: ALL_STAFF },
  { path: "/office/cheques", component: "ChequeSystem", title: "Cheque System", module: "Office Accounts", sidebarVisible: true, sidebarGroup: "Office Account", permissionKey: "Office Account", allowedRoles: ALL_STAFF },
  { path: "/office/vas-documents", component: "VasDocumentsPage", title: "VAS Documents", module: "Office Accounts", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },

  // ── Reports ───────────────────────────────────────────────────────────
  { path: "/reports", component: "UserReports", title: "Reports", module: "Reports", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/reports/:type", component: "UserReports", title: "Report", module: "Reports", sidebarVisible: false, isDynamic: true, isInternal: true, allowedRoles: ALL_STAFF, notes: "Catch-all; resolves sidebar shortcuts /reports/{loan,vas,gm,bv}." },
  { path: "/reports/raw-attendance", component: "ReportsRawAttendance", title: "Raw Attendance", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/bv-pending-rc", component: "ReportsBvPendingRc", title: "BV Pending RC Only", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/salary-create", component: "SalaryCreate", title: "Salary Create", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/salary-bonuses", component: "SalaryBonuses", title: "Employee Bonuses", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/salary", component: "SalaryReport", title: "Salary Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/attendance", component: "AttendanceReport", title: "Attendance Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/bv-pending-ecnc", component: "ReportsBvPendingEcnc", title: "BV Pending EC/NC Only", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/in-service", component: "ReportsInService", title: "In Service Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/diagnose", component: "ReportsDiagnose", title: "Diagnose Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/follow-up", component: "ReportsFollowUp", title: "Follow Up Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/projects", component: "ReportsProjects", title: "Projects Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/day-target", component: "ReportsDayTarget", title: "Day Target Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/department", component: "DepartmentReport", title: "Department Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/event", component: "EventReport", title: "Event Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/reception", component: "ReceptionReport", title: "Reception Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/edit-att", component: "EditAtt", title: "Edit Attendance", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF },
  { path: "/reports/bv/new", component: "BvReportNew", title: "New BV Report", module: "Reports", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/reports/loan/new", component: "LoanReportNew", title: "New Loan Report", module: "Reports", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/reports/loan/:id/edit", component: "LoanReportEdit", title: "Edit Loan Report", module: "Reports", sidebarVisible: false, isDynamic: true, isInternal: true, allowedRoles: ALL_STAFF, notes: "Dynamic: validates id; loading / not-found states." },
  { path: "/reports/vas/new", component: "VasReportNew", title: "New VAS Report", module: "Reports", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/reports/gm/new", component: "GmReportNew", title: "New GM Report", module: "Reports", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },
  { path: "/posting-data/link-report", component: "PostingDataLinkReport", title: "Link Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ALL_STAFF, notes: "Canonical link report (also in Posting Data group)." },
  { path: "/team-report/link-report", component: "PostingDataLinkReport", title: "Link Report (alias)", module: "Reports", sidebarVisible: false, allowedRoles: ALL_STAFF, redirectTo: "/posting-data/link-report", notes: "Alias → /posting-data/link-report." },
  { path: "/daily-reports/added-gm", component: "DailyAddedGmReport", title: "Daily Added GM Report", module: "Reports", sidebarVisible: true, sidebarGroup: "Daily Reports", permissionKey: "Daily Reports", allowedRoles: ADMIN_ONLY },

  // ── Analytics ─────────────────────────────────────────────────────────
  { path: "/analytics/user-activity", component: "UserActivityReport", title: "User Activity", module: "Analytics", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "super_hod", "hod"] },
  { path: "/analytics/ledger", component: "LedgerReport", title: "Ledger Report", module: "Analytics", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "super_hod", "hod", "account_manager"] },
  { path: "/analytics/gm", component: "GMReport", title: "GM Report", module: "Analytics", sidebarVisible: true, sidebarGroup: "Reports", permissionKey: "Report", allowedRoles: ["admin", "super_hod", "hod", "sales_manager", "account_manager"] },
  { path: "/analytics/refund", component: "RefundReport", title: "Refund Report", module: "Analytics", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "super_hod", "hod", "account_manager"] },
  { path: "/analytics/invoice", component: "InvoiceReport", title: "Invoice Report", module: "Analytics", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "super_hod", "hod", "account_manager"] },

  // ── Support ───────────────────────────────────────────────────────────
  { path: "/support/tickets", component: "SupportTickets", title: "Tickets", module: "Support", sidebarVisible: true, sidebarGroup: "Support", permissionKey: "Support", allowedRoles: ["admin", "super_hod", "hod", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"] },
  { path: "/support/tickets/:id", component: "SupportTicketDetail", title: "Ticket Detail", module: "Support", sidebarVisible: false, isDynamic: true, isInternal: true, allowedRoles: ["admin", "super_hod", "hod", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager"], notes: "Dynamic: validates id; loading / not-found states." },
  { path: "/support/complaints", component: "ComplaintsPage", title: "Complaints", module: "Support", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "super_hod", "hod", "support_agent"] },

  // ── Training ──────────────────────────────────────────────────────────
  { path: "/training", component: "TrainingCenter", title: "Training", module: "Training", sidebarVisible: true, sidebarGroup: "Training", permissionKey: "Training", allowedRoles: ALL_STAFF },
  { path: "/training/:category", component: "TrainingCenter", title: "Training Category", module: "Training", sidebarVisible: false, isDynamic: true, isInternal: true, allowedRoles: ALL_STAFF, notes: "Category param; unknown categories fall back within TrainingCenter." },

  // ── Notice / Policies ─────────────────────────────────────────────────
  { path: "/notice-board", component: "NoticeBoard", title: "Notice Board", module: "Notice", sidebarVisible: true, sidebarGroup: "Notice", permissionKey: "Notice Board", allowedRoles: ["admin", "super_hod", "reception_manager", "account_manager"] },
  { path: "/policies", component: "PoliciesSettings", title: "DRM Policies", module: "Notice", sidebarVisible: true, sidebarGroup: "Notice", permissionKey: "DRM Policies", allowedRoles: ["admin", "super_hod", "reception_manager", "account_manager"] },
  { path: "/workspace", component: "Workspace", title: "Workspace", module: "Misc", sidebarVisible: false, isInternal: true, allowedRoles: ALL_STAFF },

  // ── Portfolio ─────────────────────────────────────────────────────────
  { path: "/portfolio-add", component: "AddPortfolio", title: "Add Portfolio", module: "Portfolio", sidebarVisible: true, sidebarGroup: "Portfolio", permissionKey: "Portfolio", allowedRoles: ["admin", "verification_manager", "hod", "super_hod"] },
  { path: "/portfolio-view", component: "PortfolioList", title: "View Portfolio", module: "Portfolio", sidebarVisible: true, sidebarGroup: "Portfolio", permissionKey: "Portfolio", allowedRoles: ["admin", "verification_manager", "hod", "super_hod"] },

  // ── Settings / Admin / Users ──────────────────────────────────────────
  { path: "/super-admin", component: "SuperAdminDashboard", title: "Super Admin", module: "Settings", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "Admin", allowedRoles: ADMIN_ONLY },
  { path: "/admin", component: "AdminDashboard", title: "Admin", module: "Settings", sidebarVisible: true, sidebarGroup: "DRM Setting", permissionKey: "Admin", allowedRoles: ADMIN_ONLY },
  { path: "/drm/users/add", component: "AddUser", title: "Add User", module: "Users", sidebarVisible: true, sidebarGroup: "Users", permissionKey: "Users", allowedRoles: ADMIN_ONLY },
  { path: "/drm/users/list", component: "UserList", title: "User List", module: "Users", sidebarVisible: true, sidebarGroup: "Users", permissionKey: "Users", allowedRoles: ADMIN_ONLY },
  { path: "/drm/users/groups", component: "UserGroups", title: "User Groups", module: "Users", sidebarVisible: true, sidebarGroup: "Users", permissionKey: "Users", allowedRoles: ADMIN_ONLY },
  { path: "/allowed-ip/drm-ip-list", component: "AllowedIpList", title: "DRM IP List", module: "Settings", sidebarVisible: true, sidebarGroup: "Allowed IP", permissionKey: "Allowed IP", allowedRoles: ADMIN_ONLY },

  // ── IT / Domain Hosting ───────────────────────────────────────────────
  { path: "/it/servers", component: "ItServers", title: "Servers", module: "IT/Domain", sidebarVisible: true, sidebarGroup: "Domain Hosting", permissionKey: "Domain Hosting", allowedRoles: ["admin", "it_manager", "developer"] },
  { path: "/it/domains", component: "ItDomains", title: "Domains", module: "IT/Domain", sidebarVisible: true, sidebarGroup: "Domain Hosting", permissionKey: "Domain Hosting", allowedRoles: ["admin", "it_manager", "developer"] },
  { path: "/it/backup", component: "ItBackup", title: "Backup", module: "IT/Domain", sidebarVisible: true, sidebarGroup: "Domain Hosting", permissionKey: "Domain Hosting", allowedRoles: ["admin", "it_manager", "developer"] },
  { path: "/it/system-report", component: "ItSystemReport", title: "System Report", module: "IT/Domain", sidebarVisible: false, isInternal: true, allowedRoles: ["admin", "it_manager", "developer"] },

  // ── Posting Data ──────────────────────────────────────────────────────
  { path: "/posting-data", component: "PostingData", title: "Posting Data", module: "Product Posting", sidebarVisible: false, isInternal: true, allowedRoles: POSTING },
  { path: "/posting-data/add-products", component: "PostingData", title: "Add Products", module: "Product Posting", sidebarVisible: true, sidebarGroup: "Posting Data", permissionKey: "Posting Data", allowedRoles: POSTING },
  { path: "/posting-data/add-keywords", component: "PostingData", title: "Add Keywords", module: "Product Posting", sidebarVisible: true, sidebarGroup: "Posting Data", permissionKey: "Posting Data", allowedRoles: POSTING },
  { path: "/posting-data/keywords", component: "PostingData", title: "Keywords", module: "Product Posting", sidebarVisible: false, isInternal: true, allowedRoles: POSTING },
  { path: "/posting-data/verified", component: "PostingData", title: "Verified", module: "Product Posting", sidebarVisible: false, isInternal: true, allowedRoles: POSTING },
  { path: "/posting-data/view-keywords", component: "PostingData", title: "View Keywords", module: "Product Posting", sidebarVisible: true, sidebarGroup: "Posting Data", permissionKey: "Posting Data", allowedRoles: POSTING },
  { path: "/posting-data/view-products", component: "PostingData", title: "View Products", module: "Product Posting", sidebarVisible: true, sidebarGroup: "Posting Data", permissionKey: "Posting Data", allowedRoles: POSTING },
  { path: "/posting-data/data-verify", component: "PostingData", title: "Data Verify", module: "Product Posting", sidebarVisible: true, sidebarGroup: "Posting Data", permissionKey: "Posting Data", allowedRoles: POSTING },
  { path: "/posting-data/restricted-keywords", component: "PostingData", title: "Restricted Keywords", module: "Product Posting", sidebarVisible: true, sidebarGroup: "Posting Data", permissionKey: "Posting Data", allowedRoles: POSTING },

  // ── Target System ─────────────────────────────────────────────────────
  { path: "/target-system/create", component: "CreateTarget", title: "Create Target", module: "Target System", sidebarVisible: true, sidebarGroup: "Target System", permissionKey: "Target System", allowedRoles: ["admin", "sales_manager", "hod", "super_hod", "account_manager"] },
  { path: "/target-system/set", component: "SetTarget", title: "Set Target", module: "Target System", sidebarVisible: true, sidebarGroup: "Target System", permissionKey: "Target System", allowedRoles: ["admin", "sales_manager", "hod", "super_hod", "account_manager"] },
  { path: "/target-system/view", component: "ViewTarget", title: "View Target", module: "Target System", sidebarVisible: true, sidebarGroup: "Target System", permissionKey: "Target System", allowedRoles: ["admin", "sales_manager", "hod", "super_hod", "account_manager"] },
  { path: "/target-system/daily", component: "DailyTarget", title: "Daily Target", module: "Target System", sidebarVisible: true, sidebarGroup: "Target System", permissionKey: "Target System", allowedRoles: ["admin", "sales_manager", "hod", "super_hod", "account_manager"] },
  { path: "/target-system/add-kwa", component: "AddKwa", title: "Add KWA", module: "Target System", sidebarVisible: true, sidebarGroup: "Target System", permissionKey: "Target System", allowedRoles: ["admin", "sales_manager", "hod", "super_hod", "account_manager"] },
  { path: "/target-system/kwa-history", component: "KwaHistory", title: "KWA History", module: "Target System", sidebarVisible: true, sidebarGroup: "Target System", permissionKey: "Target System", allowedRoles: ["admin", "sales_manager", "hod", "super_hod", "account_manager"] },

  // ── Events ────────────────────────────────────────────────────────────
  { path: "/events/add", component: "EventsAdd", title: "Add Event", module: "Events", sidebarVisible: true, sidebarGroup: "Events", permissionKey: "Events", allowedRoles: ["admin", "hod", "super_hod", "marketing_manager"] },
  { path: "/events/menu", component: "EventsMenu", title: "Add Event Menu", module: "Events", sidebarVisible: true, sidebarGroup: "Events", permissionKey: "Events", allowedRoles: ["admin", "hod", "super_hod", "marketing_manager"] },
  { path: "/events/duty-planner", component: "EventsDutyPlanner", title: "Event Duty Planner", module: "Events", sidebarVisible: true, sidebarGroup: "Events", permissionKey: "Events", allowedRoles: ["admin", "hod", "super_hod", "marketing_manager"] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a wouter pattern (with :params) into a RegExp for matching. */
function patternToRegExp(pattern: string): RegExp {
  const source = pattern
    .split("/")
    .map((seg) => (seg.startsWith(":") ? "[^/]+" : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("/");
  return new RegExp(`^${source}/?$`);
}

/** Find the registry entry that matches a concrete location path. */
export function findRouteByPath(location: string): RouteEntry | undefined {
  // Prefer an exact static match, then fall back to dynamic patterns.
  const exact = routeRegistry.find((r) => r.path === location);
  if (exact) return exact;
  return routeRegistry.find((r) => r.path.includes(":") && patternToRegExp(r.path).test(location));
}

/** Resolve the canonical path for a location, following an alias if present. */
export function getCanonicalPath(location: string): string {
  const entry = findRouteByPath(location);
  return entry?.redirectTo || entry?.path || location;
}

export interface Breadcrumb {
  label: string;
  href?: string;
}

/**
 * Build a lightweight breadcrumb trail for a location: Home → Module → Page.
 * Falls back gracefully when the location is not in the registry.
 */
export function getBreadcrumbsForPath(location: string): Breadcrumb[] {
  const crumbs: Breadcrumb[] = [{ label: "Dashboard", href: "/" }];
  const entry = findRouteByPath(location);
  if (!entry || entry.path === "/" || entry.path === "/dashboard") return crumbs;

  if (entry.sidebarGroup && entry.sidebarGroup !== entry.title) {
    crumbs.push({ label: entry.sidebarGroup });
  } else if (entry.module && entry.module !== "Dashboard") {
    crumbs.push({ label: entry.module });
  }
  crumbs.push({ label: entry.title });
  return crumbs;
}
