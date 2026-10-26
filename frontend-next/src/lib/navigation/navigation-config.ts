import {
  ATTENDANCE_LEAVE,
  ATTENDANCE_LOAN,
  ATTENDANCE_MAIN,
  ATTENDANCE_OVERTIME,
  ATTENDANCE_TODO,
} from "./attendance-routes";
import {
  CUSTOMER_ACTIVE_CLIENTS,
  CUSTOMER_ADD_CUSTOMER,
  CUSTOMER_DUPLICATE_CHECKER,
  CUSTOMER_GM_BV_POOL,
  CUSTOMER_IN_SERVICE_REPORT,
  CUSTOMER_INVOICE_POOL,
  CUSTOMER_PRIVATE_POOL,
  CUSTOMER_PUBLIC_POOL,
  CUSTOMER_PUBLIC_POOL_FOLLOWUP,
  CUSTOMER_SERVICE_POOL,
  CUSTOMER_TEMP_CONTACT,
} from "./customer-routes";
import {
  DRM_ADMIN,
  DRM_ATTRIBUTES,
  DRM_BOT_SYSTEM,
  DRM_DELAY_PROJECT,
  DRM_FB_POST,
  DRM_ONLINE_FORM,
  DRM_PERMISSION,
  DRM_PMS_SETTING,
  DRM_PROMOTION,
  DRM_RELATED_CUSTOMER,
  DRM_SUPER_ADMIN,
} from "./drm-routes";
import { DAILY_REPORTS_ADDED_GM } from "./daily-reports-routes";
import { EVENTS_ADD, EVENTS_DUTY_PLANNER, EVENTS_MENU } from "./events-routes";
import { IT_BACKUP, IT_DOMAINS, IT_SERVERS } from "./domain-hosting-routes";
import {
  POSTING_DATA_ADD_KEYWORDS,
  POSTING_DATA_ADD_PRODUCTS,
  POSTING_DATA_DATA_VERIFY,
  POSTING_DATA_LINK_REPORT,
  POSTING_DATA_RESTRICTED_KEYWORDS,
  POSTING_DATA_VIEW_KEYWORDS,
  POSTING_DATA_VIEW_PRODUCTS,
} from "./posting-data-routes";
import {
  TARGET_SYSTEM_ADD_KWA,
  TARGET_SYSTEM_CREATE,
  TARGET_SYSTEM_DAILY,
  TARGET_SYSTEM_KWA_HISTORY,
  TARGET_SYSTEM_SET,
  TARGET_SYSTEM_VIEW,
} from "./target-system-routes";
import { DASHBOARD_TRAINING } from "./dashboard-routes";
import { NOTICE_BOARD, NOTICE_POLICIES } from "./notice-routes";
import {
  USER_REPORT_BV,
  USER_REPORT_GM,
  USER_REPORT_LOAN,
  USER_REPORT_VAS,
} from "./user-reports-routes";
import { PORTFOLIO_ADD, PORTFOLIO_VIEW } from "./portfolio-routes";
import { SOCIAL_MEDIA_HOME } from "./social-media-routes";
import { USERS_ADD, USERS_GROUPS, USERS_LIST } from "./users-routes";

/**
 * Sidebar inventory aligned with legacy `app-sidebar.tsx` menu groups.
 * `id` values must be unique (enforced in tests).
 */
export type NavIconKey =
  | "dashboard"
  | "customer"
  | "attendance"
  | "lead"
  | "pms"
  | "reports"
  | "training"
  | "notice"
  | "portfolio"
  | "settings"
  | "users"
  | "support"
  | "account"
  | "office"
  | "chart"
  | "hosting"
  | "branch"
  | "database"
  | "target"
  | "events"
  | "social"
  | "daily"
  | "shield"
  | "platform";

export type NavLinkItem = {
  id: string;
  label: string;
  href: string;
  permKey?: string;
};

export type NavGroup = {
  id: string;
  label: string;
  icon: NavIconKey;
  permKey?: string;
  href?: string;
  children?: NavLinkItem[];
};

/** Optional dev-only links (not shown in sidebar — use direct URL if needed). */
export const PLATFORM_NAV: NavLinkItem[] = [];

export const APP_NAV_GROUPS: NavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", href: "/dashboard", permKey: "Dashboard" },
  {
    id: "customer",
    label: "Customer",
    icon: "customer",
    permKey: "Customer",
    children: [
      { id: "customer-dup", label: "Check Duplication", href: CUSTOMER_DUPLICATE_CHECKER, permKey: "Customer" },
      { id: "customer-add", label: "Add Customer", href: CUSTOMER_ADD_CUSTOMER, permKey: "Customer" },
      { id: "customer-temp", label: "Temporary Contact", href: CUSTOMER_TEMP_CONTACT, permKey: "Customer" },
      { id: "customer-private", label: "Private Pool", href: CUSTOMER_PRIVATE_POOL, permKey: "Customer" },
      { id: "customer-service-pool", label: "Service Pool", href: CUSTOMER_SERVICE_POOL, permKey: "Customer" },
      { id: "customer-gm", label: "Gm Bv Pool", href: CUSTOMER_GM_BV_POOL, permKey: "Customer" },
      { id: "customer-in-service", label: "In service Report", href: CUSTOMER_IN_SERVICE_REPORT, permKey: "Customer" },
      { id: "customer-public", label: "Public Pool (Pick up)", href: CUSTOMER_PUBLIC_POOL, permKey: "Customer" },
      { id: "customer-public-fu", label: "Public Pool (Follow up)", href: CUSTOMER_PUBLIC_POOL_FOLLOWUP, permKey: "Customer" },
      { id: "customer-invoice", label: "Invoice Pool", href: CUSTOMER_INVOICE_POOL, permKey: "Customer" },
      { id: "customer-active", label: "Active Clients", href: CUSTOMER_ACTIVE_CLIENTS, permKey: "Customer" },
    ],
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: "attendance",
    permKey: "Attendance",
    children: [
      { id: "att-main", label: "Attendance", href: ATTENDANCE_MAIN, permKey: "Attendance" },
      { id: "att-todo", label: "To Do List", href: ATTENDANCE_TODO, permKey: "Attendance" },
      { id: "att-leave", label: "Leave Request", href: ATTENDANCE_LEAVE, permKey: "Attendance" },
      { id: "att-ot", label: "Overtime Submission", href: ATTENDANCE_OVERTIME, permKey: "Attendance" },
      { id: "att-loan", label: "Loan / Advance Salary", href: ATTENDANCE_LOAN, permKey: "Attendance" },
    ],
  },
  {
    id: "lead",
    label: "Lead",
    icon: "lead",
    permKey: "LEAD",
    children: [
      { id: "lead-pool", label: "Lead Pool", href: "/dashboard/lead/lead-pool", permKey: "LEAD" },
      { id: "lead-gmbv", label: "GM BV Pool", href: "/dashboard/lead/gm-bv-pool", permKey: "LEAD" },
    ],
  },
  {
    id: "pms",
    label: "PMS",
    icon: "pms",
    permKey: "PMS",
    children: [
      { id: "pms-tasks", label: "Task System", href: "/pms/tasks", permKey: "PMS" },
      { id: "pms-status", label: "Project Report", href: "/pms/status", permKey: "PMS" },
      { id: "pms-running", label: "Running Projects", href: "/pms/running-projects", permKey: "PMS" },
      { id: "pms-pending", label: "Pending Project", href: "/pms/approvals", permKey: "PMS" },
      { id: "pms-history", label: "Task Complete", href: "/pms/task-history", permKey: "PMS" },
      { id: "pms-closed", label: "Complete and Closed Project", href: "/pms/complete-closed-projects", permKey: "PMS" },
      { id: "pms-team", label: "Team Workspace", href: "/pms/team-workspace", permKey: "PMS" },
      { id: "pms-report", label: "Project Report (alt)", href: "/pms/project-report", permKey: "PMS" },
    ],
  },
  {
    id: "user-reports",
    label: "User Reports",
    icon: "reports",
    permKey: "User Reports",
    children: [
      { id: "ur-loan", label: "Loan Report", href: USER_REPORT_LOAN, permKey: "User Reports" },
      { id: "ur-vas", label: "VAS Report", href: USER_REPORT_VAS, permKey: "User Reports" },
      { id: "ur-gm", label: "GM Report", href: USER_REPORT_GM, permKey: "User Reports" },
      { id: "ur-bv", label: "BV Report", href: USER_REPORT_BV, permKey: "User Reports" },
    ],
  },
  {
    id: "notice",
    label: "Notice",
    icon: "notice",
    permKey: "Notice",
    children: [
      { id: "notice-board", label: "Notice Board", href: NOTICE_BOARD, permKey: "Notice Board" },
      { id: "notice-policies", label: "DRM Policies", href: NOTICE_POLICIES, permKey: "DRM Policies" },
    ],
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: "portfolio",
    permKey: "Portfolio",
    children: [
      { id: "port-add", label: "Add Portfolio", href: PORTFOLIO_ADD, permKey: "Portfolio" },
      { id: "port-view", label: "View Portfolio", href: PORTFOLIO_VIEW, permKey: "Portfolio" },
    ],
  },
  {
    id: "drm-setting",
    label: "DRM Setting",
    icon: "settings",
    permKey: "DRM Setting",
    children: [
      { id: "drm-super", label: "Super Admin", href: DRM_SUPER_ADMIN, permKey: "Admin" },
      { id: "drm-admin", label: "Admin", href: DRM_ADMIN, permKey: "Admin" },
      { id: "drm-audit", label: "Audit Logs", href: "/dashboard/audit-logs", permKey: "Admin" },
      { id: "drm-attr", label: "Attributes", href: DRM_ATTRIBUTES, permKey: "DRM Setting" },
      { id: "drm-perm", label: "Drm Permission", href: DRM_PERMISSION, permKey: "DRM Setting" },
      { id: "drm-promo", label: "Promotion", href: DRM_PROMOTION, permKey: "DRM Setting" },
      { id: "drm-delay", label: "Delay Project", href: DRM_DELAY_PROJECT, permKey: "DRM Setting" },
      { id: "drm-related", label: "Related Customer", href: DRM_RELATED_CUSTOMER, permKey: "DRM Setting" },
      { id: "drm-pms", label: "Pms Project Setting", href: DRM_PMS_SETTING, permKey: "DRM Setting" },
      { id: "drm-bot", label: "Bot system", href: DRM_BOT_SYSTEM, permKey: "DRM Setting" },
      { id: "drm-online", label: "Online Form", href: DRM_ONLINE_FORM, permKey: "DRM Setting" },
      { id: "drm-fb", label: "Fb Post", href: DRM_FB_POST, permKey: "DRM Setting" },
    ],
  },
  {
    id: "users",
    label: "Users",
    icon: "users",
    permKey: "Users",
    children: [
      { id: "users-add", label: "Add User", href: USERS_ADD, permKey: "Users" },
      { id: "users-list", label: "List", href: USERS_LIST, permKey: "Users" },
      { id: "users-groups", label: "Groups", href: USERS_GROUPS, permKey: "Users" },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: "support",
    permKey: "Support",
    children: [{ id: "support-tickets", label: "Tickets", href: "/support/tickets", permKey: "Support" }],
  },
  {
    id: "account",
    label: "Account",
    icon: "account",
    permKey: "Account",
    children: [
      { id: "acct-gm", label: "Create GM", href: "/account/gm-entries", permKey: "Account" },
      { id: "acct-invoice", label: "Make Invoice", href: "/account/invoices", permKey: "Account" },
      { id: "acct-ledger", label: "Company Ledger", href: "/account/ledger", permKey: "Account" },
    ],
  },
  {
    id: "office-account",
    label: "Office Account",
    icon: "office",
    permKey: "Office Account",
    children: [
      { id: "office-tb", label: "Trial Balance Report", href: "/office/trial-balance-report", permKey: "Office Account" },
      { id: "office-coa", label: "Chart of Account", href: "/office/chart-of-accounts", permKey: "Office Account" },
      { id: "office-gl", label: "General Ledger", href: "/office/general-ledger", permKey: "Office Account" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: "chart",
    permKey: "Reports",
    children: [
      { id: "rep-att", label: "Attendance Report", href: "/reports/attendance", permKey: "Reports" },
      { id: "rep-salary", label: "Salary Report", href: "/reports/salary", permKey: "Reports" },
      { id: "rep-projects", label: "Projects Report", href: "/reports/projects", permKey: "Reports" },
      { id: "rep-increment", label: "Increment", href: "/drm/increment", permKey: "Increment" },
      { id: "rep-add-penalty", label: "Add Penalty", href: "/drm/add-penalty", permKey: "Add Penalty" },
    ],
  },
  {
    id: "domain-hosting",
    label: "Domain Hosting",
    icon: "hosting",
    permKey: "Domain Hosting",
    children: [
      { id: "it-servers", label: "Servers", href: IT_SERVERS, permKey: "Domain Hosting" },
      { id: "it-domains", label: "Domains", href: IT_DOMAINS, permKey: "Domain Hosting" },
      { id: "it-backup", label: "Backup", href: IT_BACKUP, permKey: "Domain Hosting" },
    ],
  },
  {
    id: "posting-data",
    label: "Posting Data",
    icon: "database",
    permKey: "Posting Data",
    children: [
      { id: "pd-products", label: "Add Products", href: POSTING_DATA_ADD_PRODUCTS, permKey: "Posting Data" },
      { id: "pd-keywords", label: "Add Keywords", href: POSTING_DATA_ADD_KEYWORDS, permKey: "Posting Data" },
      { id: "pd-view-kw", label: "View Keywords", href: POSTING_DATA_VIEW_KEYWORDS, permKey: "Posting Data" },
      { id: "pd-view-prod", label: "View Products", href: POSTING_DATA_VIEW_PRODUCTS, permKey: "Posting Data" },
      { id: "pd-verify", label: "Data Verify", href: POSTING_DATA_DATA_VERIFY, permKey: "Posting Data" },
      { id: "pd-link-report", label: "Link Report", href: POSTING_DATA_LINK_REPORT, permKey: "Posting Data" },
      {
        id: "pd-restricted",
        label: "Restricted Keywords",
        href: POSTING_DATA_RESTRICTED_KEYWORDS,
        permKey: "Posting Data",
      },
    ],
  },
  {
    id: "target-system",
    label: "Target System",
    icon: "target",
    permKey: "Target System",
    children: [
      { id: "ts-create", label: "Create", href: TARGET_SYSTEM_CREATE, permKey: "Target System" },
      { id: "ts-set", label: "Set", href: TARGET_SYSTEM_SET, permKey: "Target System" },
      { id: "ts-view", label: "View", href: TARGET_SYSTEM_VIEW, permKey: "Target System" },
      { id: "ts-daily", label: "Daily", href: TARGET_SYSTEM_DAILY, permKey: "Target System" },
      { id: "ts-add-kwa", label: "Add Kwa", href: TARGET_SYSTEM_ADD_KWA, permKey: "Target System" },
      { id: "ts-kwa-history", label: "Kwa History", href: TARGET_SYSTEM_KWA_HISTORY, permKey: "Target System" },
    ],
  },
  {
    id: "events",
    label: "Events",
    icon: "events",
    permKey: "Events",
    children: [
      { id: "ev-add", label: "Add Event", href: EVENTS_ADD, permKey: "Events" },
      { id: "ev-menu", label: "Add Event Menu", href: EVENTS_MENU, permKey: "Events" },
      { id: "ev-duty", label: "Event Duty Planner", href: EVENTS_DUTY_PLANNER, permKey: "Events" },
    ],
  },
  {
    id: "social",
    label: "Social Media Posting",
    icon: "social",
    permKey: "Social Media Posting",
    children: [
      { id: "sm-post", label: "Add Post / Statistics", href: SOCIAL_MEDIA_HOME, permKey: "Social Media Posting" },
      { id: "sm-training", label: "Training", href: DASHBOARD_TRAINING, permKey: "Training" },
    ],
  },
  {
    id: "daily-reports",
    label: "Daily Reports",
    icon: "daily",
    permKey: "Daily Reports",
    children: [{ id: "dr-gm", label: "Daily Added Gm Report", href: DAILY_REPORTS_ADDED_GM, permKey: "Daily Reports" }],
  },
  {
    id: "allowed-ip",
    label: "Allowed IP",
    icon: "shield",
    permKey: "Allowed IP",
    children: [
      { id: "ip-list", label: "DRM IP List", href: "/dashboard/allowed-ip/drm-ip-list", permKey: "Allowed IP" },
    ],
  },
];

export function collectNavIds(): string[] {
  const ids: string[] = [];
  for (const g of APP_NAV_GROUPS) {
    ids.push(g.id);
    g.children?.forEach((c) => ids.push(c.id));
  }
  PLATFORM_NAV.forEach((p) => ids.push(p.id));
  return ids;
}

export function findNavTitle(pathname: string): string | null {
  for (const p of PLATFORM_NAV) {
    if (pathname === p.href || pathname.startsWith(`${p.href}/`)) return p.label;
  }
  for (const g of APP_NAV_GROUPS) {
    for (const c of g.children ?? []) {
      if (pathname === c.href || pathname.startsWith(`${c.href}/`)) return c.label;
    }
    if (g.href) {
      if (g.href === "/dashboard") {
        if (pathname === "/dashboard" || pathname === "/dashboard/") return g.label;
      } else if (pathname === g.href || pathname.startsWith(`${g.href}/`)) {
        return g.label;
      }
    }
  }
  if (pathname === "/") return "Next home";
  return null;
}
