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
  Play,
  Package,
  LayoutGrid,
  Inbox,
  Edit,
  ScrollText,
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
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface MenuItem {
  title: string;
  icon: LucideIcon;
  url?: string;
  items?: MenuItem[];
  /** permission-menu name to match against drm.menu_permissions */
  permKey?: string;
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
      { title: "Customer Management", url: "/sales/customers", icon: Contact },
      { title: "Check Duplication", url: "/sales/duplicate-checker", icon: FileSearch },
      { title: "Add Customer", url: "/sales/add-customer", icon: UserPlus },
      { title: "Temporary Contact", url: "/customer/temporary-contact", icon: UserCircle },
      { title: "Add GM", url: "/gm-pool/add-gm", icon: PlusCircle },
      { title: "Private Pool", url: "/customers/private-pool", icon: Database },
      { title: "Service Pool", url: "/customers/service-pool", icon: Database },
      { title: "Public Pool", url: "/customers/public-pool", icon: Database },
      { title: "Tracking", url: "/sales/tracing", icon: History },
      { title: "Invoice Pool", url: "/sales/invoice-pool", icon: FileText },
    ],
  },
  {
    title: "Attendance", icon: CalendarCheck, permKey: "Attendance",
    items: [
      { title: "Attendance", url: "/hr/attendance", icon: Clock },
      { title: "To Do List", url: "/hr/attendance/todo", icon: ClipboardList },
      { title: "Leave Request", url: "/hr/leave-request", icon: Calendar },
      { title: "Overtime Submission", url: "/hr/overtime", icon: Timer },
      { title: "Loan / Advance Salary", url: "/hr/loan", icon: Banknote },
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
      { title: "Task Templates", url: "/pms/task-templates", icon: FileText },
      { title: "Task Creation", url: "/pms/tasks", icon: CheckSquare },
      { title: "Project Status", url: "/pms/status", icon: BarChart3 },
      { title: "Running Projects", url: "/pms/running-projects", icon: DollarSign },
      { title: "Pending Approvals", url: "/pms/approvals", icon: UserCheck },
      { title: "Task History", url: "/pms/task-history", icon: History },
      { title: "Team Workspace", url: "/pms/team-workspace", icon: Users },
      { title: "Project Report", url: "/pms/project-report", icon: FileText },
    ],
  },
  {
    title: "User Reports", icon: FileText, permKey: "User Reports",
    items: [
      { title: "Loan Report", url: "/reports/loan", icon: FileText },
      { title: "VAS Report", url: "/reports/vas", icon: FileText },
      { title: "GM Report", url: "/reports/gm", icon: FileText },
      { title: "BV Report", url: "/reports/bv", icon: FileText },
    ],
  },
  { title: "Training", icon: GraduationCap, url: "/training", permKey: "Training" },
  {
    title: "Notice", icon: Inbox, permKey: "Notice",
    items: [
      { title: "Notice Board", url: "/notice-board", icon: ClipboardList, permKey: "Notice Board" },
      { title: "DRM Policies", url: "/policies", icon: ShieldCheck, permKey: "DRM Policies" },
    ],
  },
  {
    title: "Portfolio", icon: ImageIcon, permKey: "Portfolio",
    items: [
      { title: "Add Portfolio", url: "/portfolio-add", icon: UserPlus },
      { title: "View Portfolio", url: "/portfolio-view", icon: List },
    ],
  },
  {
    title: "DRM Setting", icon: Settings, permKey: "DRM Setting",
    items: [
      { title: "Super Admin", url: "/super-admin", icon: Crown, permKey: "Admin" },
      { title: "Admin", url: "/admin", icon: ShieldCheck, permKey: "Admin" },
      { title: "Audit Logs", url: "/admin/audit-logs", icon: ScrollText, permKey: "Admin" },
      { title: "Attributes", url: "/drm/attributes", icon: List },
      { title: "Drm Permission", url: "/drm/permission", icon: Shield },
      { title: "Promotion", url: "/drm/promotion", icon: Megaphone },
      { title: "Delay Project", url: "/drm/delay-project", icon: Clock },
      { title: "Related Customer", url: "/drm/related-customer", icon: Contact },
      { title: "Pms Project Setting", url: "/drm/pms-setting", icon: Settings },
      { title: "Bot system", url: "/drm/bot-system", icon: Bot },
      { title: "Online Form", url: "/drm/online-form", icon: FileText },
      { title: "Fb Post", url: "/drm/fb-post", icon: Facebook },
    ],
  },
  {
    title: "Users", icon: Users, permKey: "Users",
    items: [
      { title: "Add User", url: "/drm/users/add", icon: UserPlus },
      { title: "List", url: "/drm/users/list", icon: Users },
      { title: "Groups", url: "/drm/users/groups", icon: Users },
    ],
  },
  {
    title: "Support", icon: Headset, permKey: "Support",
    items: [{ title: "Tickets", url: "/support/tickets", icon: Ticket }],
  },
  {
    title: "Account", icon: DollarSign, permKey: "Account",
    items: [
      { title: "Create GM", url: "/account/gm-entries", icon: Star },
      { title: "Add Temp GM", url: "/account/temp-gm", icon: Clock },
      { title: "Add Refund GM", url: "/account/refund-gm", icon: RotateCcw },
      { title: "Donations", url: "/account/donations", icon: Globe },
      { title: "Make Invoice", url: "/account/invoices", icon: FileText },
      { title: "Company Ledger", url: "/account/ledger", icon: Building2 },
      { title: "AB Report", url: "/account/ab-report", icon: BarChart3 },
      { title: "Dollar System", url: "/account/dollar-system", icon: DollarSign },
    ],
  },
  {
    title: "Office Account", icon: Wallet, permKey: "Office Account",
    items: [
      { title: "Trial Balance Report", url: "/office/trial-balance-report", icon: FileText },
      { title: "Old Account Head", url: "/office/old-account-head", icon: History },
      { title: "Chart of Account", url: "/office/chart-of-accounts", icon: BarChart3 },
      // { title: "Account Head", url: "/office/account-head", icon: FileText },
      { title: "Business Customer", url: "/office/business-customers", icon: Building2 },
      { title: "Office Vas", url: "/office/vas", icon: TrendingUp },
      { title: "Office Expense", url: "/office/expenses", icon: Receipt },
      { title: "Cheque System", url: "/office/cheques", icon: CreditCard },
    ],
  },
  {
    title: "Reports", icon: PieChart, permKey: "Report",
    items: [
      { title: "Raw Attendance", url: "/reports/raw-attendance", icon: FileText },
      { title: "Bv Pending RC Only", url: "/reports/bv-pending-rc", icon: FileText },
      { title: "Loan Report", url: "/reports/loan", icon: FileText },
      { title: "Salary Create", url: "/reports/salary-create", icon: FileText },
      { title: "Salary Report", url: "/reports/salary", icon: FileText },
      { title: "Attendance Report", url: "/reports/attendance", icon: FileText },
      { title: "Vas Report", url: "/reports/vas", icon: List },
      { title: "Gm Report", url: "/analytics/gm", icon: Star },
      { title: "Bv Report", url: "/reports/bv", icon: FileText },
      { title: "Bv Pending EC/NC Only", url: "/reports/bv-pending-ecnc", icon: FileText },
      { title: "In Service Report", url: "/reports/in-service", icon: FileText },
      { title: "Diagnose Report", url: "/reports/diagnose", icon: FileText },
      { title: "Follow Up Report", url: "/reports/follow-up", icon: FileText },
      { title: "Projects Report", url: "/reports/projects", icon: FileText },
      { title: "Day Target Report", url: "/reports/day-target", icon: FileText },
      { title: "Link Report", url: "/posting-data/link-report", icon: Link2 },
      { title: "Department Report", url: "/reports/department", icon: FileText },
      { title: "Event Report", url: "/reports/event", icon: Calendar },
      { title: "Reception Report", url: "/reports/reception", icon: FileText },
      { title: "Edit Att", url: "/reports/edit-att", icon: Edit },
    ],
  },
  { title: "Increment", icon: TrendingUp, url: "/drm/increment", permKey: "Increment" },
  { title: "Add Penalty", icon: ShieldCheck, url: "/drm/add-penalty", permKey: "Add Penalty" },
  {
    title: "Domain Hosting", icon: FileText, permKey: "Domain Hosting",
    items: [
      { title: "Servers", url: "/it/servers", icon: Server },
      { title: "Domains", url: "/it/domains", icon: Globe },
      { title: "Backup", url: "/it/backup", icon: Database },
    ],
  },
  {
    title: "Posting Data", icon: Database, permKey: "Posting Data",
    items: [
      { title: "Add Products", url: "/posting-data/add-products", icon: PlusCircle },
      { title: "Add Keywords", url: "/posting-data/add-keywords", icon: PlusSquare },
      { title: "View Keywords", url: "/posting-data/view-keywords", icon: LayoutGrid },
      { title: "View Products", url: "/posting-data/view-products", icon: FileText },
      { title: "Data Verify", url: "/posting-data/data-verify", icon: CheckSquare },
      { title: "Link Report", url: "/posting-data/link-report", icon: Link2 },
      { title: "Restricted Keywords", url: "/posting-data/restricted-keywords", icon: ShieldAlert },
    ],
  },
  {
    title: "Target System", icon: Target, permKey: "Target System",
    items: [
      { title: "Create", url: "/target-system/create", icon: PlusCircle },
      { title: "Set", url: "/target-system/set", icon: Settings },
      { title: "View", url: "/target-system/view", icon: List },
      { title: "Daily", url: "/target-system/daily", icon: Calendar },
      { title: "Add Kwa", url: "/target-system/add-kwa", icon: PlusSquare },
      { title: "Kwa History", url: "/target-system/kwa-history", icon: History },
    ],
  },
  {
    title: "Events", icon: Calendar, permKey: "Events",
    items: [
      { title: "Add Event", url: "/events/add", icon: Calendar },
      { title: "Add Event Menu", url: "/events/menu", icon: List },
      { title: "Event Duty Planner", url: "/events/duty-planner", icon: ClipboardList },
    ],
  },
  {
    title: "Social Media Posting", icon: Contact, permKey: "Social Media Posting",
    items: [
      { title: "Add Post/View Statistics", url: "/social-media", icon: Share2 },
    ],
  },
  {
    title: "Daily Reports", icon: FileText, permKey: "Daily Reports",
    items: [
      { title: "Daily Added Gm Report", url: "/daily-reports/added-gm", icon: FileText },
    ],
  },
  {
    title: "Allowed IP", icon: Shield, permKey: "Allowed IP",
    items: [
      { title: "DRM IP List", url: "/allowed-ip/drm-ip-list", icon: List },
    ],
  },
];

// Map department NAME → which role categories can see it
const DEPT_NAME_TO_ROLES: Record<string, string[]> = {
  "Admin": ["admin", "super_admin", "administrator", "junior_admin"],
  "Super HOD": ["admin", "super_admin", "super_hod"],
  "Head of Department": ["admin", "super_admin", "super_hod", "hod", "software_manager", "lead_manager"],
  "Sales Department": ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "verification_manager"],
  "Lead Department": ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "verification_manager", "lead_manager", "lead_executive"],
  "Accounts Department": ["admin", "account_manager", "accountant", "hod", "super_hod"],
  "Service Department": ["admin", "support_agent", "hod", "super_hod", "service_manager", "service_assistant_manager", "service_executive"],
  "Service Assistant Manager": ["admin", "super_admin", "hod", "super_hod", "service_manager", "service_assistant_manager"],
  "Lead Executive Dashboard": ["admin", "super_admin", "hod", "super_hod", "lead_manager", "lead_executive"],
  "Reception Department": ["admin", "support_agent", "hod", "super_hod"],
  "IT Department": ["admin", "developer", "hod", "super_hod", "it_manager"],
  "Software Department": ["admin", "developer", "hod", "super_hod", "it_manager", "software_manager", "software_executive"],
  "QA Department": ["admin", "developer", "hod", "super_hod", "qa_manager", "verification_manager"],
  "Verification Department": ["admin", "hod", "super_hod", "sales_manager", "qa_manager", "verification_manager"],
  "Complaint Department": ["admin", "support_agent", "hod", "super_hod"],
  "Marketing Department": ["admin", "hod", "super_hod", "marketing_manager"],
  "Media Department": ["admin", "hod", "super_hod"],
  "D&D Department": ["admin", "hod", "super_hod", "dd_manager", "dd_executive"],
  "SEO/SMM Department": ["admin", "hod", "super_hod", "seo_smm_manager"],
  "Product Posting": ["admin", "hod", "super_hod", "product_posting_manager"],
  "Posting Executive": ["admin", "hod", "super_hod", "product_posting_executive", "posting_executive"],
  "Project Department": ["admin", "developer", "hod", "super_hod", "qa_manager", "verification_manager"],
  "Internship & Trainee": ["admin", "hod", "super_hod"],
  "Portfolio": ["admin", "verification_manager", "hod", "super_hod"],
  "Web Excels": ["admin", "super_hod"],
  "Trade Assurance": ["admin", "sales_executive", "sales_manager", "hod", "super_hod"],
  "Customer": ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "reception_manager", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  "Attendance": ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "developer", "support_agent", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "reception_manager", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  "PMS": ["admin", "super_admin", "service_manager", "service_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "developer", "support_agent", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "reception_manager", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  "LEAD": ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "reception_manager", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  "Training": ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod", "developer", "support_agent", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "reception_manager", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  "User Reports": ["admin", "sales_executive", "sales_manager", "account_manager", "manager", "hod", "super_hod", "qa_manager", "verification_manager", "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", "posting_executive", "it_manager", "reception_manager", "service_manager", "service_executive", "seo_smm_manager", "software_manager", "software_executive", "lead_manager", "lead_executive"],
  "Domain Hosting": ["admin", "it_manager", "developer"],
  "Posting Data": ["admin", "hod", "super_hod", "product_posting_manager", "service_department", "product_posting_executive", "posting_executive"],
  "Add Keywords": ["admin", "hod", "super_hod", "product_posting_manager"],
  "Notice": ["admin", "super_admin", "reception_manager"],
  "Notice Board": ["admin", "super_admin", "reception_manager"],
  "DRM Policies": ["admin", "super_admin", "reception_manager"],
  "Events": ["admin", "hod", "super_hod", "marketing_manager"],
  "Social Media Posting": ["admin", "hod", "super_hod", "marketing_manager"],
  "Target System": ["admin", "sales_manager", "hod", "super_hod"],
  "Daily Reports": ["admin", "super_admin"],
  "Allowed IP": ["admin", "super_admin"],
  "Report": ["admin", "super_hod", "hod", "service_manager", "service_executive", "software_manager", "software_executive", "lead_manager", "lead_executive", "marketing_manager", "it_manager", "reception_manager"],
  "Increment": ["admin", "super_admin", "super_hod", "hod", "manager", "sales_manager", "sales_assistant_manager", "account_manager", "service_manager", "software_manager", "it_manager", "lead_manager", "marketing_manager", "qa_manager", "verification_manager", "dd_manager", "product_posting_manager", "reception_manager", "seo_smm_manager"],
  "Add Penalty": ["admin", "super_admin", "super_hod", "hod", "hr", "hr_manager", "dd_manager", "dnd_manager", "product_posting_manager", "software_manager"],
};

// ─── Permission check: does this user's role have access? ────────────────────
function hasAccess(
  menuPermissions: MenuPermission[],
  permKey: string | undefined,
  userRoleName: string | null,    // active role (e.g. "developer")
  userAllRoles: string[],          // all assigned roles
): boolean {
  if (!permKey) return true; // no restriction = always visible

  const entry = menuPermissions.find(
    (p) => p.name.trim().toLowerCase() === permKey.trim().toLowerCase()
  );

  // Check if it's explicitly deactivated in DB
  if (entry && !entry.isActive) return false;

  // All roles the user has (active + assigned)
  const baseRoles = [
    ...(userRoleName ? [userRoleName.toLowerCase().replace(/\s+/g, "_")] : []),
    ...userAllRoles.map(r => r.toLowerCase().replace(/\s+/g, "_")),
  ];

  const rolesSet = new Set(baseRoles);

  // Role Aliasing Database Compatibility Fix
  if (rolesSet.has("product_posting_executive")) rolesSet.add("posting_executive");
  if (rolesSet.has("posting_executive")) rolesSet.add("product_posting_executive");
  if (rolesSet.has("product_posting_manager")) rolesSet.add("posting_manager");
  if (rolesSet.has("posting_manager")) rolesSet.add("product_posting_manager");

  const roles = Array.from(rolesSet);

  // STRICT GUI DENY LIST WORKAROUND for roles bleeding unwanted visibility
  if (rolesSet.has("posting_executive") || rolesSet.has("product_posting_executive")) {
    if (permKey === "Portfolio") return false;
  }
  
  if (rolesSet.has("sales_assistant_manager")) {
    if (permKey === "Target System") return false;
  }

  // Safety: Customer module must always show for these core roles
  if (permKey === "Customer") {
    const coreRoles = ["admin", "super_admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "hod", "super_hod"];
    if (roles.some(r => coreRoles.includes(r))) return true;
  }

  // 1. Check Database Roles First (Direct assignment from DRM page)
  if (entry && Array.isArray(entry.allowedRoleIds) && entry.allowedRoleIds.length > 0) {
    // Normalize DB roles too (just in case they have spaces like "Service Manager")
    const allowed = entry.allowedRoleIds.map(r => r.toLowerCase().trim().replace(/\s+/g, "_"));
    return roles.some(r => allowed.includes(r));
  }

  // Admin/super_admin always have access (bypass for safety ONLY if no DB roles defined)
  if (roles.some(r => ["admin", "super_admin", "administrator", "adm"].includes(r))) return true;

  // 2. Fallback to Hardcoded Map (if not defined in DB or no roles assigned in DB)
  const hardcodedAllowed = DEPT_NAME_TO_ROLES[permKey];
  if (hardcodedAllowed !== undefined) {
    return roles.some(r => hardcodedAllowed.includes(r));
  }

  // 3. Fallback to Database Department Permissions (Old logic)
  if (entry) {
    const entryPerms = entry.permissions || []; 
    if (entryPerms.length === 0) return true;   

    for (const dept of entryPerms) {
      const allowedRoles = DEPT_NAME_TO_ROLES[dept.name] || [];
      if (roles.some(r => allowedRoles.includes(r))) return true;
    }
  }

  // Final fallback: hide
  return false;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AppSidebar() {
  const [location] = useLocation();
  const { state } = useSidebar();

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
    developer: "/dashboard/software-executive",
    software_manager: "/dashboard/software-manager",
    software_executive: "/dashboard/software-executive",
    seo_smm_manager: "/dashboard/seo-smm",
    marketing_manager: "/dashboard/marketing-manager",
    lead_manager: "/dashboard/lead-manager",
    lead_executive: "/dashboard/lead-executive",
  };

  // ── Filter top-level menu items ─────────────────────────────────────────────
  const filteredItems = menuItems.filter((item) => {
    // Modify Dashboard URL based on role
    if (item.title === "Dashboard") {
      const activeRoleKey = (userRoleName || "").toLowerCase().replace(/\s+/g, "_");
      item.url = ROLE_SIDEBAR_DASHBOARDS[activeRoleKey] || "/";
      return true;
    }
    
    // Items with no permKey — show to all logged-in users
    if (!item.permKey) return true;
    // Explicit admin/super_admin exception: real admins always get full nav.
    if (isRealAdmin) return true;
    // Fail-closed: while permissions are still loading, hide permissioned items
    // (a skeleton is shown in their place).
    if (permsLoading) return false;
    // Fail-closed: if permissions failed to load, show only minimal nav.
    if (permsError) return false;
    // Check permission from DB (hasAccess also covers the hardcoded role map
    // when no DB rows exist for a given menu).
    const rolesToUse = isImpersonating ? [] : userAllRoles;
    const isAllowed = hasAccess(menuPermissions, item.permKey, userRoleName, rolesToUse);
    if (item.title === "Reports" || item.title === "Customer") {
      console.log(`DEBUG ${item.title} visibility:`, {
         permKey: item.permKey,
         userRoleName,
         userAllRoles: rolesToUse,
         isAllowed,
         entry: menuPermissions.find(p => p.name.trim().toLowerCase() === item.permKey?.trim().toLowerCase())
      });
    }
    return isAllowed;
  });

  // ── Render helpers ──────────────────────────────────────────────────────────
  const getDynamicUrl = (url: string | undefined) => {
    if (!url) return undefined;
    return url;
  };

  const renderSubItems = (items: MenuItem[], parentPermKey?: string) => {
    const rolesToUse = isImpersonating ? [] : userAllRoles;
    const visibleItems = items.filter(subItem => {
      const currentUserRoles = [
         ...(userRoleName ? [userRoleName.toLowerCase().replace(/\s+/g, "_")] : []),
         ...rolesToUse.map(r => r.toLowerCase().replace(/\s+/g, "_"))
      ];

      // Hide Task Creation explicitly for Sales Executive
      if (subItem.title === "Task Creation" && currentUserRoles.includes("sales_executive")) {
         return false;
      }

      // Hide Invoice Pool for reception_manager (sales-only feature)
      if (subItem.title === "Invoice Pool" && currentUserRoles.includes("reception_manager")) {
         return false;
      }

      // If the parent menu or this subitem has a specific permKey, we check the DB
      // Check standard permKey logic
      let hasStandardAccess = hasAccess(menuPermissions, subItem.permKey, userRoleName, rolesToUse);
      
      // Strict subUrls check: Only check against the parent's permission entry!
      if (!subItem.permKey && subItem.url && parentPermKey && menuPermissions.length > 0) {
         const parentEntry = menuPermissions.find(p => p.name.trim().toLowerCase() === parentPermKey.trim().toLowerCase());
         if (parentEntry && parentEntry.subUrls && Array.isArray(parentEntry.subUrls.items) && parentEntry.subUrls.items.length > 0) {
            // Check if user has access to this parent entry explicitly via roles
            const userRoles = [
               ...(userRoleName ? [userRoleName.toLowerCase().replace(/\s+/g, "_")] : []),
               ...rolesToUse.map(r => r.toLowerCase().replace(/\s+/g, "_"))
            ];
            const allowed = (parentEntry.allowedRoleIds || []).map(r => r.toLowerCase().trim().replace(/\s+/g, "_"));
            const userInEntry = userRoles.some(r => allowed.includes(r));
            const isAdmin = userRoles.some(r => ["admin", "super_admin", "administrator", "adm"].includes(r));
            
            if (userInEntry && !isAdmin) {
               // Parent is explicitly restricted by subUrls for this user.
               const isListed = parentEntry.subUrls.items.some((u: string) => {
                  if (u === subItem.url) return true;
                  if (subItem.url && subItem.url.toLowerCase().includes(u.toLowerCase())) return true;
                  const cleanU = u.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const cleanTitle = subItem.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (cleanU && cleanTitle && (cleanTitle.includes(cleanU) || cleanU.includes(cleanTitle))) return true;
                  
                  // Special mappings for common typos / slugs they used in DB
                  if (subItem.title === "Task Templates") return true;
                  if (u === "attendance-check" && subItem.url?.includes("attendance")) return true;
                  if (u === "leave-form" && subItem.url?.includes("leave-request")) return true;
                  if (u === "advance-salary" && subItem.url?.includes("loan")) return true;
                  if (u === "temp-contact" && subItem.url?.includes("temporary-contact")) return true;
                  if (u === "in-service-report" && subItem.url?.includes("tracing")) return true;
                  if (u === "pms-projects" && subItem.url?.includes("status")) return true;
                  if (u === "pms-task-create" && subItem.url?.includes("tasks")) return true;
                  if (u === "pms-running-project" && subItem.url?.includes("running-projects")) return true;
                  if (u === "pms-pending-project" && subItem.url?.includes("approvals")) return true;
                  if (u === "pms-project-task" && subItem.url?.includes("task-history")) return true;
                  if (u === "work-spaces" && subItem.url?.includes("workspace")) return true;
                  if (u === "kwa-add" && subItem.url?.includes("add-kwa")) return true;
                  if (u === "target-day" && subItem.url?.includes("daily")) return true;
                  
                  // Force GM BV Pool visibility if they have access to LEAD menu
                  if (subItem.url?.includes("gmbv-pool")) return true;
                  if (subItem.url?.includes("lead-pools")) return true;
                  
                  // Force Posting Data submenus
                  if (subItem.url?.includes("add-products")) return true;
                  if (subItem.url?.includes("add-keywords")) return true;
                  if (subItem.url?.includes("view-keywords")) return true;
                  if (subItem.url?.includes("view-products")) return true;

                  return false;
               });
               
               if (!isListed) {
                  return false;
               }
            }
         }
      }

      return hasStandardAccess;
    });

    return visibleItems.map((subItem) => {
      const isSubActive = location === subItem.url;
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
                      <SidebarMenuSubButton asChild className={`${sidebarText} ${hoverSub} ${location === nested.url ? activeClass : ""} pl-8`}>
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
        <SidebarMenuSubItem key={subItem.title}>
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
          <div className="px-4 py-4 border-b border-sidebar-border">
            <div className="flex items-center justify-start h-16 min-h-16" data-testid="img-logo">
              <img
                src="/webexcels-logo.png"
                alt="WebExcels logo"
                className="h-[50px] w-auto max-w-full object-contain"
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
                          <HoverCardTrigger asChild>
                            <div className="w-full">
                              <SidebarMenuButton className={`${sidebarText} ${hoverMain}`}>
                                <item.icon className="w-5 h-5" />
                                <span>{item.title}</span>
                                <ChevronDown className="ml-auto w-4 h-4" />
                              </SidebarMenuButton>
                            </div>
                          </HoverCardTrigger>
                          <HoverCardContent side="right" align="start" className="w-56 p-0 border-none shadow-xl overflow-hidden bg-transparent">
                            <div className="bg-[#2c3b41] text-white px-4 py-3 flex items-center gap-2">
                              <item.icon className="w-4 h-4" />
                              <span className="font-medium">{item.title}</span>
                            </div>
                            <div className="bg-[#00a65a] py-2 flex flex-col">
                              {item.items.map((subItem) => (
                                <Link key={subItem.title} href={getDynamicUrl(subItem.url)!}
                                  className={`flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white dark:bg-zinc-900/10 transition-colors ${location === subItem.url ? "bg-white dark:bg-zinc-900/20 font-medium" : ""}`}>
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
                        <HoverCardTrigger asChild>
                          <div className="w-full">
                            <SidebarMenuButton asChild className={`${sidebarText} ${hoverMain} ${location === item.url ? activeClass : ""}`}>
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
                              className={`flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white dark:bg-zinc-900/10 transition-colors ${location === item.url ? "bg-white dark:bg-zinc-900/20 font-medium" : ""}`}>
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
                    <SidebarMenuButton asChild className={`${sidebarText} ${hoverMain} ${location === item.url ? activeClass : ""}`}>
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

