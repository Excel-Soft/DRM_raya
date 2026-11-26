import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  FileText,
  UserCircle,
  ClipboardList,
  FolderOpen,
  Briefcase,
  BarChart3,
  GraduationCap,
  ChevronDown,
  CheckSquare,
  UserPlus,
  FileSearch,
  Database,
  Headset,
  Ticket,
  TrendingUp,
  Contact,
  Clock,
  Calendar,
  Timer,
  Banknote,
  UserCheck,
  Building2,
  Star,
  Globe,
  Layers,
  DollarSign,
  History,
  RotateCcw,
  Receipt,
  CreditCard,
  Award,
  Zap,
  Crown,
  Wallet,
  PieChart,
  Activity,
  Book,
  Settings,
  List,
  Shield,
  ShieldCheck,
  Megaphone,
  Bot,
  Facebook,
  Target,
  Bell,
  Server,
  Image as ImageIcon,
  Share2,
  Video,
  PartyPopper,
  PlusCircle,
  PlusSquare,
  Link2,
  ShieldAlert,
  Trash2,
  Play,
  Package,
  LayoutGrid,
  Inbox,
  Edit,
  ScrollText,
  DatabaseBackup,
  BookOpen,
  NotebookPen,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { isSupportModuleEnabled, isBotSystemEnabled, isOnlineFormEnabled, isFbPostEnabled } from "@/lib/feature-flags";
import { useState, useEffect } from "react";
import { canonicalRoleKeys } from "@/lib/legacy-role-keys";
import { grantingRows, subItemVisible } from "@/lib/sidebar-access";

// ─── Types ───────────────────────────────────────────────────────────────────
interface MenuItem {
  title: string;
  icon: LucideIcon;
  url?: string;
  items?: MenuItem[];
  /** permission-menu name to match against drm.menu_permissions */
  permKey?: string;
  /** old DRM sub-URL slug on the parent menu row (DRM Permission "Sub-URL") */
  slug?: string;
  /** page that did not exist in old DRM: shows with its menu until a sub-URL controls it */
  newPage?: boolean;
}

interface MenuPermission {
  id: string;
  name: string;
  menuIcon: string;
  permissions: { name: string; type: string }[];
  subUrls: { isRoot: boolean; items: string[] };
  allowedRoleIds: string[];
  isActive: boolean;
}

// ─── Icon map ─────────────────────────────────────────────────────────────────
const iconMap: Record<string, LucideIcon> = {
  Users, CalendarCheck, TrendingUp, Settings, DollarSign,
  Briefcase, Target, FileText, Server, ClipboardList,
  Image: ImageIcon, Database, Bell, Shield, ShieldCheck, PartyPopper,
  Video, Share2, LayoutDashboard, Layers, Wallet, Package, LayoutGrid
};

// ─── All sidebar menu definitions (with permKey linking to DB menu names) ────
const menuItems: MenuItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/dashboard", permKey: "Dashboard" },
  // permKey must match the `name` field in drm.menu_permissions
  {
    title: "Customer", icon: TrendingUp, permKey: "Customer",
    items: [
      { title: "Check Duplication", url: "/sales/duplicate-checker", icon: FileSearch, slug: "duplication" },
      { title: "Add Customer", url: "/sales/add-customer", icon: UserPlus, slug: "add-customer" },
      { title: "Temporary Contact", url: "/customer/temporary-contact", icon: UserCircle, slug: "temp-contact" },
      { title: "Private Pool", url: "/customers/private-pool", icon: Database, slug: "private-pool" },
      { title: "Service Pool", url: "/customers/service-pool", icon: Database, slug: "service-pool" },
      { title: "Gm Bv Pool", url: "/gm-pool/add-gm", icon: PlusCircle, slug: "gm-bv-pool" },
      { title: "In service Report", url: "/reports/in-service", icon: FileText, slug: "in-service-report" },
      { title: "Public Pool(Pick up)", url: "/customers/public-pool", icon: Database, slug: "public-pool" },
      { title: "Public Pool(Follow up)", url: "/customers/public-pool-followup", icon: Database, slug: "global_followup" },
      { title: "Invoice Pool", url: "/sales/invoice-pool", icon: FileText, slug: "invoice-pool" },
      { title: "Active Clients", url: "/sales/active-clients", icon: Users, slug: "active-client" },
    ],
  },
  {
    title: "Attendance", icon: CalendarCheck, permKey: "Attendance",
    items: [
      { title: "Attendance", url: "/hr/attendance", icon: Clock, slug: "attendance-check" },
      { title: "To Do List", url: "/hr/attendance/todo", icon: ClipboardList, slug: "to-do-list" },
      { title: "Leave Request", url: "/hr/leave-request", icon: Calendar, slug: "leave-form" },
      { title: "Overtime Submission", url: "/hr/overtime", icon: Timer, slug: "over-time" },
      { title: "Loan / Advance Salary", url: "/hr/loan", icon: Banknote, slug: "advance-salary" },
    ],
  },
  {
    title: "Lead", icon: Layers, permKey: "LEAD",
    items: [
      { title: "Lead Pool", url: "/sales/lead-pools", icon: Database },
      { title: "GM BV Pool", url: "/customers/gmbv-pool", icon: Database },
    ],
  },
  {
    title: "PMS", icon: ClipboardList, permKey: "PMS",
    items: [
      { title: "Task System", url: "/pms/tasks", icon: CheckSquare, slug: "pms-task-create" },
      { title: "Project Report", url: "/pms/status", icon: BarChart3, slug: "pms-projects" },
      { title: "Overall Projects", url: "/pms/overall-projects", icon: List, slug: "pms-overall-projects" },
      { title: "Running Projects", url: "/pms/running-projects", icon: DollarSign, slug: "pms-running-project" },
      { title: "Pending Project", url: "/pms/approvals", icon: UserCheck, slug: "pms-pending-project" },
      { title: "Task Complete", url: "/pms/task-history", icon: History, slug: "pms-project-task" },
      { title: "Complete and Closed Project", url: "/pms/complete-closed-projects", icon: CheckCircle2, slug: "pms-complete-closed" },
      { title: "Team Workspace", url: "/pms/team-workspace", icon: Users, slug: "work-spaces" },
      { title: "Project Report", url: "/pms/project-report", icon: FileText, slug: "dep-report" },
    ],
  },
  {
    title: "User Reports", icon: FileText, permKey: "User Reports",
    items: [
      { title: "Loan Report", url: "/reports/loan", icon: FileText, slug: "advance-salary" },
      { title: "VAS Report", url: "/reports/vas", icon: FileText, slug: "vas-report" },
      { title: "GM Report", url: "/reports/gm", icon: FileText, slug: "gm-report" },
      { title: "BV Report", url: "/reports/bv", icon: FileText, slug: "bv-report" },
    ],
  },
  { title: "Training", icon: GraduationCap, url: "/training", permKey: "Training" },
  {
    title: "Notice", icon: Inbox, permKey: "Notice",
    items: [
      { title: "Notice Board", url: "/notice-board", icon: ClipboardList, slug: "pms-notesboard" },
      { title: "DRM Policies", url: "/policies", icon: ShieldCheck, slug: "drm-policies" },
    ],
  },
  {
    title: "Portfolio", icon: ImageIcon, permKey: "Portfolio",
    items: [
      { title: "Add Portfolio", url: "/portfolio-add", icon: UserPlus, slug: "portfolio-add" },
      { title: "View Portfolio", url: "/portfolio-view", icon: List, slug: "portfolio-view" },
    ],
  },
  {
    title: "DRM Setting", icon: Settings, permKey: "DRM Setting",
    items: [
      { title: "Super Admin", url: "/super-admin", icon: Crown, permKey: "Admin" },
      { title: "Admin", url: "/admin", icon: ShieldCheck, permKey: "Admin" },
      { title: "Audit Logs", url: "/admin/audit-logs", icon: ScrollText, permKey: "Admin" },
      { title: "Login Audit", url: "/admin/login-audit", icon: ScrollText, permKey: "Admin" },
      { title: "Old Data Import", url: "/admin/legacy-import", icon: DatabaseBackup, permKey: "Admin" },
      { title: "Attributes", url: "/drm/attributes", icon: List, slug: "drm-attributes" },
      { title: "Drm Permission", url: "/drm/permission", icon: Shield, slug: "drm-permission" },
      { title: "Promotion", url: "/drm/promotion", icon: Megaphone, slug: "add-promotion" },
      { title: "Delay Project", url: "/drm/delay-project", icon: Clock, slug: "project-delay-fillter" },
      { title: "Related Customer", url: "/drm/related-customer", icon: Contact, slug: "related-customer" },
      { title: "Pms Project Setting", url: "/drm/pms-setting", icon: Settings, slug: "pms-project-assign" },
      { title: "Bot system", url: "/drm/bot-system", icon: Bot, slug: "bot-system" },
      { title: "Online Form", url: "/drm/online-form", icon: FileText, slug: "form-created" },
      { title: "Fb Post", url: "/drm/fb-post", icon: Facebook, slug: "fb-post" },
    ],
  },
  {
    title: "Users", icon: Users, permKey: "Users",
    items: [
      { title: "Add User", url: "/drm/users/add", icon: UserPlus, slug: "add-users" },
      { title: "List", url: "/drm/users/list", icon: Users, slug: "users-list" },
      { title: "Groups", url: "/drm/users/groups", icon: Users, slug: "groups" },
    ],
  },
  {
    title: "Support", icon: Headset, permKey: "Support",
    items: [{ title: "Tickets", url: "/support/tickets", icon: Ticket }],
  },
  {
    title: "Account", icon: DollarSign, permKey: "Account",
    items: [
      { title: "Create GM", url: "/account/gm-entries", icon: Star, slug: "create-gm" },
      { title: "Add Temp GM", url: "/account/temp-gm", icon: Clock, slug: "create-tem-gm" },
      { title: "Add Refund GM", url: "/account/refund-gm", icon: RotateCcw, slug: "refund-list" },
      { title: "Donations", url: "/account/donations", icon: Globe, slug: "donations" },
      { title: "Make Invoice", url: "/account/invoices", icon: FileText, slug: "make-invoice" },
      { title: "Company Ledger", url: "/account/ledger", icon: Building2, slug: "company-ledger" },
      { title: "AB Report", url: "/account/ab-report", icon: BarChart3, slug: "ab-report", newPage: true },
      { title: "Dollar System", url: "/account/dollar-system", icon: DollarSign, slug: "dollar-system", newPage: true },
    ],
  },
  {
    title: "Office Account", icon: Wallet, permKey: "Office Account",
    items: [
      { title: "Trial Balance Report", url: "/office/trial-balance-report", icon: FileText, slug: "trial-balance-report" },
      { title: "Chart of Account", url: "/office/chart-of-accounts", icon: BarChart3, slug: "chart-of-account" },
      { title: "General Ledger", url: "/office/general-ledger", icon: BookOpen, slug: "general-ledger", newPage: true },
      { title: "Journal Voucher", url: "/office/journal-voucher", icon: NotebookPen, slug: "journal-voucher", newPage: true },
      // { title: "Account Head", url: "/office/account-head", icon: FileText },
      { title: "Business Customer", url: "/office/business-customers", icon: Building2, slug: "busniess-customer" },
      { title: "Office Vas", url: "/office/vas", icon: TrendingUp, slug: "office-vas" },
      { title: "Office Expense", url: "/office/expenses", icon: Receipt, slug: "expenses-report" },
      { title: "Cheque System", url: "/office/cheques", icon: CreditCard, slug: "cheque-system" },
    ],
  },
  {
    title: "Reports", icon: PieChart, permKey: "Reports",
    items: [
      { title: "Raw Attendance", url: "/reports/raw-attendance", icon: FileText, slug: "zk-att" },
      { title: "Bv Pending RC Only", url: "/reports/bv-pending-rc", icon: FileText, slug: "bv-pending-report" },
      { title: "Loan Report", url: "/reports/loan?scope=company", icon: FileText, slug: "advance-salary" },
      { title: "Salary Create", url: "/reports/salary-create", icon: FileText, slug: "salary-create" },
      { title: "Employee Bonuses", url: "/reports/salary-bonuses", icon: FileText, slug: "salary-bonuses", newPage: true },
      { title: "Salary Report", url: "/reports/salary", icon: FileText, slug: "salary-report" },
      { title: "Balance Report", url: "/reports/balance-report", icon: FileText, slug: "balance-report", newPage: true },
      { title: "Attendance Report", url: "/reports/attendance", icon: FileText, slug: "attendance-report" },
      { title: "Vas Report", url: "/reports/vas?scope=company", icon: List, slug: "vas-report" },
      { title: "Gm Report", url: "/analytics/gm", icon: Star, slug: "gm-report" },
      { title: "Bv Report", url: "/reports/bv?scope=company", icon: FileText, slug: "bv-report" },
      { title: "Bv Pending EC/NC Only", url: "/reports/bv-pending-ecnc", icon: FileText, slug: "gmbv-person" },
      { title: "Diagnose Report", url: "/reports/diagnose", icon: FileText, slug: "diagnose-report" },
      { title: "Follow Up Report", url: "/reports/follow-up", icon: FileText, slug: "follow-report" },
      { title: "Projects Report", url: "/reports/projects", icon: FileText, slug: "project-report" },
      { title: "Day Target Report", url: "/reports/day-target", icon: FileText, slug: "target-report" },
      { title: "Link Report", url: "/posting-data/link-report", icon: Link2, slug: "link-report" },
      { title: "Department Report", url: "/reports/department", icon: FileText, slug: "dep-report" },
      { title: "Event Report", url: "/reports/event", icon: Calendar, slug: "event-report" },
      { title: "Reception Report", url: "/reports/reception", icon: FileText, slug: "reception-report" },
      { title: "Edit Att", url: "/reports/edit-att", icon: Edit, slug: "edit-att" },
      // Moved here from the top level. Each keeps its own permKey, so the same roles
      // still see it even without access to the rest of Reports (child permKey override).
      { title: "Add Penalty", url: "/drm/add-penalty", icon: ShieldCheck, slug: "add-penalty" },
      { title: "Increment", url: "/drm/increment", icon: TrendingUp, slug: "increment" },
    ],
  },
  {
    title: "Domain Hosting", icon: FileText, permKey: "Domain Hosting",
    items: [
      { title: "Servers", url: "/it/servers", icon: Server, slug: "server-settings" },
      { title: "Domains", url: "/it/domains", icon: Globe, slug: "domain-list" },
      { title: "Backup", url: "/it/backup", icon: Database, slug: "domain-backup" },
    ],
  },
  {
    title: "Posting Data", icon: Database, permKey: "Posting Data",
    items: [
      { title: "Add Products", url: "/posting-data/add-products", icon: PlusCircle, slug: "add-posting-products" },
      { title: "Add Keywords", url: "/posting-data/add-keywords", icon: PlusSquare, slug: "add-posting-keywords" },
      { title: "View Keywords", url: "/posting-data/view-keywords", icon: LayoutGrid, slug: "view-posting-keywords" },
      { title: "View Products", url: "/posting-data/view-products", icon: FileText, slug: "view-posting-product" },
      { title: "Restricted Products", url: "/posting-data/restricted-products", icon: ShieldAlert, slug: "restricted-products" },
      { title: "Trash Products", url: "/posting-data/trash-products", icon: Trash2, slug: "trash-products" },
      { title: "Data Verify", url: "/posting-data/data-verify", icon: CheckSquare, slug: "data-verify" },
      { title: "Link Report", url: "/posting-data/link-report", icon: Link2, slug: "link-report" },
      { title: "Restricted Keywords", url: "/posting-data/restricted-keywords", icon: ShieldAlert, slug: "restricted-keywords" },
    ],
  },
  {
    title: "Target System", icon: Target, permKey: "Target System",
    items: [
      { title: "Create", url: "/target-system/create", icon: PlusCircle, slug: "target-create" },
      { title: "Set", url: "/target-system/set", icon: Settings, slug: "target-set" },
      { title: "View", url: "/target-system/view", icon: List, slug: "target-view" },
      { title: "Daily", url: "/target-system/daily", icon: Calendar, slug: "target-day" },
      { title: "Add Kwa", url: "/target-system/add-kwa", icon: PlusSquare, slug: "kwa-add" },
      { title: "Kwa History", url: "/target-system/kwa-history", icon: History, slug: "kwa-history" },
    ],
  },
  {
    title: "Events", icon: Calendar, permKey: "Events",
    items: [
      { title: "Add Event", url: "/events/add", icon: Calendar, slug: "add-event" },
      { title: "Add Event Menu", url: "/events/menu", icon: List, slug: "event-menu" },
      { title: "Event Duty Planner", url: "/events/duty-planner", icon: ClipboardList, slug: "event-duty-planner" },
    ],
  },
  {
    title: "Social Media Posting", icon: Contact, permKey: "Social Media Posting",
    items: [
      { title: "Add Post/View Statistics", url: "/social-media", icon: Share2, slug: "today-posts" },
    ],
  },
  {
    title: "Daily Reports", icon: FileText, permKey: "Daily Reports",
    items: [
      { title: "Daily Added Gm Report", url: "/daily-reports/added-gm", icon: FileText, slug: "daily-gm-record" },
    ],
  },
  {
    title: "Allowed IP", icon: Shield, permKey: "Allowed IP",
    items: [
      { title: "DRM IP List", url: "/allowed-ip/drm-ip-list", icon: List, slug: "drm-allowed-ip" },
    ],
  },
];

// ─── Permission check: DRM Permission page only (see lib/sidebar-access.ts) ──
function hasAccess(
  menuPermissions: MenuPermission[],
  permKey: string | undefined,
  userRoleName: string | null,    // active role (e.g. "developer")
  userAllRoles: string[],          // all assigned roles
): boolean {
  if (!permKey) return true; // no restriction = always visible
  // Only the role selected in the ROLE switcher counts (a multi-role user sees one
  // role's menus at a time); all assigned roles only when no role is selected.
  const roles = userRoleName ? [userRoleName] : userAllRoles;
  return grantingRows(menuPermissions, permKey, roles).length > 0;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AppSidebar() {
  const [location] = useLocation();
  // Active-link highlighting below compares against the full href (path +
  // query) so entries that differ only by query string — e.g. the two "Loan
  // Report" links, one plain and one with ?scope=company — each highlight
  // only when that exact one was navigated to, not whichever ignores it.
  const search = useSearch();
  const fullLocation = search ? `${location}?${search}` : location;
  const { state, setOpen } = useSidebar();

  // AB Report is wide (lots of side-by-side cards/tables) — collapse the
  // sidebar to icon-only automatically while viewing it, like a user would
  // do manually on Dollar System, and restore it on navigating away.
  useEffect(() => {
    if (location.startsWith("/account/ab-report")) {
      setOpen(false);
      return () => setOpen(true);
    }
  }, [location, setOpen]);

  const sidebarBg = "bg-sidebar";
  const sidebarText = "text-sidebar-foreground";
  const hoverMain = "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
  const hoverSub = "hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground";
  const activeClass = "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-100 dark:hover:bg-emerald-800/40 font-medium transition-colors";

  // ── Fetch live permissions from DB ──────────────────────────────────────────
  const { data: menuPermissions = [], isLoading: permsLoading, isError: permsError } = useQuery<MenuPermission[]>({
    queryKey: ["/api/drm/permissions"],
    queryFn: async () => {
      const token = sessionStorage.getItem("token") || "";
      const res = await fetch("/api/drm/permissions", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      // Throw on failure so the query reports an error state and the sidebar
      // can fail CLOSED (minimal nav) instead of silently treating it as "no
      // restrictions".
      if (!res.ok) throw new Error("Failed to load permissions");
      return res.json();
    },
    staleTime: 0, // Always fresh - re-fetch on every page load
    refetchOnMount: true,
    retry: 1,
  });

  // ── Get current user role info (reactive) ─────────────────────────────────
  const [userRoleName, setUserRoleName] = useState<string | null>(
    () => sessionStorage.getItem("userRole")
  );
  const [userAllRoles, setUserAllRoles] = useState<string[]>(() => {
    try {
      const s = sessionStorage.getItem("userRoles");
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  // Listen for sessionStorage changes (e.g. after role switch)
  useEffect(() => {
    const handleStorage = () => {
      setUserRoleName(sessionStorage.getItem("userRole"));
      try {
        const s = sessionStorage.getItem("userRoles");
        setUserAllRoles(s ? JSON.parse(s) : []);
      } catch { setUserAllRoles([]); }
    };
    window.addEventListener("storage", handleStorage);
    // Also poll every 500ms in case the change happens in the same tab
    const interval = setInterval(handleStorage, 500);
    return () => {
      window.removeEventListener("storage", handleStorage);
      clearInterval(interval);
    };
  }, []);

  // ── Admin check helper ──────────────────────────────────────────────────────
  const adminKeys = ["admin", "super_admin", "administrator", "adm"];

  // Read JWT directly — most reliable source, unaffected by sessionStorage staleness
  const jwtPayload = (() => {
    try {
      const t = sessionStorage.getItem("token") || "";
      return t ? JSON.parse(atob(t.split(".")[1])) : null;
    } catch { return null; }
  })();

  const isImpersonating = !!(jwtPayload?.impersonatorId);
  const isAdminByJwt = adminKeys.includes((jwtPayload?.roleId || "").toLowerCase()) ||
    (Array.isArray(jwtPayload?.roles) && jwtPayload.roles.some((r: string) => adminKeys.includes(r.toLowerCase())));
  const isAdminByStorage = adminKeys.includes((userRoleName || "").toLowerCase().replace(/\s+/g, "_")) ||
    userAllRoles.some(r => adminKeys.includes(r.toLowerCase().replace(/\s+/g, "_")));

  // For menu visibility, we now respect the DRM settings for everyone.
  // We keep isRealAdmin for other non-sidebar safety checks if needed,
  // but for the menu itself, we will use hasAccess.
  const isRealAdmin = !isImpersonating && (isAdminByJwt || isAdminByStorage);

  // Role dashboards map for dynamic sidebar link
  const ROLE_SIDEBAR_DASHBOARDS: Record<string, string> = {
    sales_manager: "/dashboard/sales-manager",
    sales_assistant_manager: "/dashboard/sales-assistant-manager",
    sales_executive: "/dashboard/sales-executive",
    account_manager: "/dashboard/account-manager",
    service_manager: "/dashboard/service-manager",
    service_assistant_manager: "/dashboard/service-assistant-manager",
    service_executive: "/dashboard/service-executive",
    super_hod: "/dashboard/super-hod",
    hod: "/dashboard/hod",
    dd_manager: "/dashboard/dd-manager",
    dd_executive: "/dashboard/dd-executive",
    qa_manager: "/qa/manager",
    verification_manager: "/verification/manager",
    product_posting_manager: "/product-posting/manager",
    product_posting_executive: "/product-posting/executive",
    posting_executive: "/product-posting/executive",
    reception_manager: "/dashboard/reception",
    it_manager: "/dashboard/it-manager",
    it_executive: "/dashboard/it-executive",
    developer: "/dashboard/developer",
    software_manager: "/dashboard/software-manager",
    software_executive: "/dashboard/software-executive",
    seo_smm_manager: "/dashboard/seo-smm",
    seo_smm_executive: "/dashboard/seo-smm-executive",
    marketing_manager: "/dashboard/marketing-manager",
    lead_manager: "/dashboard/lead-manager",
    lead_executive: "/dashboard/lead-executive",
    complaint_manager: "/dashboard/complaint-manager",
  };

  // ── Render helpers ──────────────────────────────────────────────────────────
  const getDynamicUrl = (url: string | undefined) => {
    if (!url) return undefined;
    return url;
  };

  // Shared filter used by both the expanded Collapsible (renderSubItems) and
  // the collapsed-state HoverCard flyout, so a role that only reached this
  // group via a child's own permKey override (see filteredItems above) never
  // sees permKey-less siblings leak through either rendering path.
  const getVisibleSubItems = (items: MenuItem[], parentPermKey?: string): MenuItem[] => {
    const rolesToUse = isImpersonating ? [] : userAllRoles;
    const parentAccessGranted = hasAccess(menuPermissions, parentPermKey, userRoleName, rolesToUse);
  const jwtRoleKeys = [
    jwtPayload?.roleId,
    ...(Array.isArray(jwtPayload?.roles) ? jwtPayload.roles : []),
  ]
    .filter(Boolean)
    .map((r: string) => String(r).toLowerCase().replace(/\s+/g, "_"));
    return items.filter(subItem => {
      const currentUserRoles = Array.from(
        new Set([
          ...(userRoleName ? [userRoleName.toLowerCase().replace(/\s+/g, "_")] : []),
          ...rolesToUse.map((r) => r.toLowerCase().replace(/\s+/g, "_")),
          ...jwtRoleKeys,
        ]),
      );
      const isAdminTier = currentUserRoles.some((r) =>
        ["admin", "super_admin", "administrator", "adm"].includes(r),
      );

      // Hide Invoice Pool for reception_manager (sales-only feature)
      if (subItem.title === "Invoice Pool" && currentUserRoles.includes("reception_manager")) {
         return false;
      }

      // Complete and Closed Project is a manager-only report (the backend
      // 403s any non-managerial role) — hide it for pure executives, not admins
      // who also carry an executive role in their multi-role list.
      if (
        subItem.title === "Complete and Closed Project"
        && !isAdminTier
        && currentUserRoles.some((r) => r.includes("executive"))
      ) {
         return false;
      }
      if (
        subItem.title === "Overall Projects"
        && !isAdminTier
        && currentUserRoles.some((r) => r.includes("executive"))
      ) {
        return false;
      }

      // MD-22 (Project Owner, 2026-07-27): Bot System / Online Form / FB Post are
      // mock chat-widget stubs with no real provider behind them — hidden from
      // every dashboard until each is individually approved and flagged on.
      if (subItem.title === "Bot system" && !isBotSystemEnabled()) {
         return false;
      }
      if (subItem.title === "Online Form" && !isOnlineFormEnabled()) {
         return false;
      }
      if (subItem.title === "Fb Post" && !isFbPostEnabled()) {
         return false;
      }

      // Fail-closed during permission load/error (mirrors the top-level nav):
      // real admins always retain full nav; everyone else must wait for the DB
      // permissions to resolve instead of falling back to the hardcoded map.
      if (subItem.permKey && !isRealAdmin && (permsLoading || permsError)) {
         return false;
      }

      // Mirrors the top-level nav's admin exception (line ~592): real admins
      // always get full nav. Without this, a sub-item whose allowedRoleIds was
      // explicitly set via the DRM Permission page short-circuits hasAccess()
      // on a plain role-list match — if the live role state doesn't literally
      // contain "admin" for any reason, the item silently disappears even for
      // a real admin, unlike top-level items which never hit that code path.
      // Same carve-out as the top level: explicit "Active/Deactive" still wins.
      if (subItem.permKey && isRealAdmin) {
        const entry = menuPermissions.find(
          (p) => p.name.trim().toLowerCase() === subItem.permKey!.trim().toLowerCase()
        );
        if (entry && !entry.isActive) return false;
        return true;
      }

      // Admin-only items (permKey "Admin" has no menu row) and other own-permKey items.
      if (subItem.permKey) return hasAccess(menuPermissions, subItem.permKey, userRoleName, rolesToUse);
      if (!parentPermKey) return true;
      // Real admins get every page of a menu they can see (menu deactivation is
      // enforced at the top level).
      if (isRealAdmin) return true;
      if (!subItem.slug) return false;
      const roles = userRoleName ? [userRoleName] : rolesToUse;
      return subItemVisible(menuPermissions, parentPermKey, roles, subItem.slug, !!subItem.newPage);
    });
  };

  // ── Filter top-level menu items ─────────────────────────────────────────────
  const filteredItems = menuItems.filter((item) => {
    // Patch 4 Stage 6 (ISS-02 P2): hide the entire Support section while the
    // Support module is deactivated for the current phase. Reversible via the
    // VITE_SUPPORT_MODULE_ENABLED flag.
    if (item.permKey === "Support" && !isSupportModuleEnabled()) return false;
    // Temporarily hidden for everyone, including real admins — remove this
    // line to bring the "Lead" section (Lead Pool / GM BV Pool) back.
    if (item.permKey === "LEAD") return false;
    // Modify Dashboard URL based on role
    if (item.title === "Dashboard") {
      const activeRoleKey = (userRoleName || "").toLowerCase().replace(/\s+/g, "_");
      item.url = ROLE_SIDEBAR_DASHBOARDS[activeRoleKey] || "/";
      return true;
    }
    
    // Items with no permKey — show to all logged-in users
    if (!item.permKey) return true;
    // Explicit admin/super_admin exception: real admins always get full nav,
    // UNLESS the menu was explicitly deactivated on the DRM Permission page —
    // "Active/Deactive" means hidden for everyone, admin included, not just
    // role-restricted. Without this check isRealAdmin short-circuited before
    // hasAccess() ever consulted entry.isActive, so deactivating a module had
    // no visible effect for admins.
    if (isRealAdmin) {
      const entry = menuPermissions.find(
        (p) => p.name.trim().toLowerCase() === item.permKey!.trim().toLowerCase()
      );
      if (entry && !entry.isActive) return false;
      return true;
    }
    // Fail-closed: while permissions are still loading, hide permissioned items
    // (a skeleton is shown in their place).
    if (permsLoading) return false;
    // Fail-closed: if permissions failed to load, show only minimal nav.
    if (permsError) return false;
    // Check permission from DB (hasAccess also covers the hardcoded role map
    // when no DB rows exist for a given menu).
    const rolesToUse = isImpersonating ? [] : userAllRoles;
    const isAllowed = hasAccess(menuPermissions, item.permKey, userRoleName, rolesToUse);
    // A group shows only if at least one of its pages is allowed too.
    if (isAllowed && Array.isArray(item.items)) return getVisibleSubItems(item.items, item.permKey).length > 0;
    return isAllowed;
  });

  const renderSubItems = (items: MenuItem[], parentPermKey?: string) => {
    const visibleItems = getVisibleSubItems(items, parentPermKey);
    return visibleItems.map((subItem) => {
      const isSubActive = fullLocation === subItem.url;
      if (subItem.items) {
        return (
          <Collapsible key={subItem.title} defaultOpen={subItem.items.some((n) => n.url === location)} className="group/nested-collapsible">
            <SidebarMenuSubItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuSubButton className={`${sidebarText} ${hoverSub}`}>
                  <subItem.icon className="w-4 h-4" />
                  <span>{subItem.title}</span>
                  <ChevronDown className="ml-auto w-4 h-4 transition-transform group-data-[state=open]/nested-collapsible:rotate-180" />
                </SidebarMenuSubButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {subItem.items.map((nested) => (
                    <SidebarMenuSubItem key={nested.title}>
                      <SidebarMenuSubButton asChild className={`${sidebarText} ${hoverSub} ${fullLocation === nested.url ? activeClass : ""} pl-8`}>
                        <Link href={getDynamicUrl(nested.url)!} data-testid={`link-${nested.title.toLowerCase().replace(/\s+/g, "-")}`}>
                          <nested.icon className="w-4 h-4" />
                          <span>{nested.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuSubItem>
          </Collapsible>
        );
      }
      return (
        <SidebarMenuSubItem key={subItem.url || subItem.title}>
          <SidebarMenuSubButton asChild className={`${sidebarText} ${hoverSub} ${isSubActive ? activeClass : ""}`}>
            <Link href={getDynamicUrl(subItem.url)!} data-testid={`link-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}>
              <subItem.icon className="w-4 h-4" />
              <span>{subItem.title}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      );
    });
  };

  return (
    <Sidebar collapsible="icon" className={`${sidebarBg} ${sidebarText}`}>
      <SidebarContent className={`${sidebarBg} ${sidebarText}`}>
        <SidebarGroup>
          <div className="px-4 py-3 border-b border-sidebar-border">
            <div
              className="flex items-center justify-start h-24 min-h-24 dark:bg-white dark:rounded-lg dark:p-2 dark:w-fit"
              data-testid="img-logo"
            >
              <img
                src="/webexcels-logo.png"
                alt="WebExcels logo"
                className="h-[90px] w-auto max-w-full object-contain mix-blend-multiply dark:mix-blend-normal"
              />
            </div>
          </div>
          <SidebarGroupContent className={`${sidebarBg} ${sidebarText}`}>
            <SidebarMenu>
              {filteredItems.map((item) => {
                // ── Item with sub-items ──────────────────────────────────────
                if (item.items) {
                  // Collapsed: hover card flyout
                  if (state === "collapsed") {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <HoverCard openDelay={0} closeDelay={100}>
                          <HoverCardTrigger className="w-full block">
                            <SidebarMenuButton className={`${sidebarText} ${hoverMain}`}>
                              <item.icon className="w-5 h-5" />
                              <span>{item.title}</span>
                              <ChevronDown className="ml-auto w-4 h-4" />
                            </SidebarMenuButton>
                          </HoverCardTrigger>
                          <HoverCardContent side="right" align="start" className="w-56 p-0 border-none shadow-xl overflow-hidden bg-transparent">
                            <div className="bg-[#2c3b41] text-white px-4 py-3 flex items-center gap-2">
                              <item.icon className="w-4 h-4" />
                              <span className="font-medium">{item.title}</span>
                            </div>
                            <div className="bg-[#00a65a] py-2 flex flex-col">
                              {getVisibleSubItems(item.items, item.permKey).map((subItem) => (
                                <Link key={subItem.title} href={getDynamicUrl(subItem.url)!}
                                  className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-black/10 ${fullLocation === subItem.url ? "bg-white text-[#00a65a] font-medium dark:bg-zinc-900/60 dark:text-emerald-400" : "text-white dark:bg-zinc-900/10"}`}>
                                  <subItem.icon className="w-4 h-4 opacity-90" />
                                  <span>{subItem.title}</span>
                                </Link>
                              ))}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </SidebarMenuItem>
                    );
                  }

                  // Expanded: collapsible
                  return (
                    <Collapsible key={item.title} defaultOpen={item.items.some((sub) => sub.url === location)} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            tooltip={item.title}
                            className={`${sidebarText} ${hoverMain}`}
                            data-testid={`button-sidebar-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <item.icon className="w-5 h-5" />
                            <span>{item.title}</span>
                            <ChevronDown className="ml-auto w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {renderSubItems(item.items, item.permKey)}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                // ── Single item ──────────────────────────────────────────────
                if (state === "collapsed") {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <HoverCard openDelay={0} closeDelay={100}>
                        <HoverCardTrigger className="w-full block">
                          <div className="w-full">
                            <SidebarMenuButton asChild className={`${sidebarText} ${hoverMain} ${fullLocation === item.url ? activeClass : ""}`}>
                              <Link href={getDynamicUrl(item.url)!} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                                <item.icon className="w-5 h-5" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="right" align="start" className="w-56 p-0 border-none shadow-xl overflow-hidden bg-transparent">
                          <div className="bg-[#2c3b41] text-white px-4 py-3 flex items-center gap-2">
                            <item.icon className="w-4 h-4" />
                            <span className="font-medium">{item.title}</span>
                          </div>
                          <div className="bg-[#00a65a] py-2 flex flex-col">
                            <Link href={getDynamicUrl(item.url)!}
                              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-black/10 ${fullLocation === item.url ? "bg-white text-[#00a65a] font-medium dark:bg-zinc-900/60 dark:text-emerald-400" : "text-white dark:bg-zinc-900/10"}`}>
                              <item.icon className="w-4 h-4 opacity-90" />
                              <span>{item.title}</span>
                            </Link>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className={`${sidebarText} ${hoverMain} ${fullLocation === item.url ? activeClass : ""}`}>
                      <Link href={getDynamicUrl(item.url)!} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

