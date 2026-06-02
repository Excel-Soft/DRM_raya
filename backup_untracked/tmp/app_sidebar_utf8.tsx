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
  Package,
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

// ÔöÇÔöÇÔöÇ Types ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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

// ÔöÇÔöÇÔöÇ Icon map ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const iconMap: Record<string, LucideIcon> = {
  Users, CalendarCheck, TrendingUp, Settings, DollarSign,
  Briefcase, Target, FileText, Server, ClipboardList,
  Image: ImageIcon, Database, Bell, Shield, PartyPopper,
  Video, Share2, LayoutDashboard, Layers, Wallet,
};

// ÔöÇÔöÇÔöÇ All sidebar menu definitions (with permKey linking to DB menu names) ÔöÇÔöÇÔöÇÔöÇ
const menuItems: MenuItem[] = [
  { title: "Dashboard", icon: LayoutDashboard, url: "/" },
  { title: "HOD Dashboard", icon: LayoutDashboard, url: "/dashboard/hod", permKey: "Head of Department" },
  { title: "Product Posting", icon: Package, url: "/product-posting", permKey: "Product Posting" },

  // permKey must match the `name` field in drm.menu_permissions
  {
    title: "Customer", icon: TrendingUp, permKey: "Customer",
    items: [
      { title: "Customer Management", url: "/sales/customers", icon: Contact },
      { title: "Check Duplication", url: "/sales/duplicate-checker", icon: FileSearch },
      { title: "Add Customer", url: "/sales/add-customer", icon: UserPlus },
      { title: "Temporary Contact", url: "/customer/temporary-contact", icon: UserCircle },
      { title: "Private Pool", url: "/customers/private-pool", icon: Database },
      { title: "Service Pool", url: "/customers/service-pool", icon: Database },
      { title: "GM Pool - Add GM", url: "/gm-pool/add-gm", icon: Star },
      { title: "In service Report", url: "/reports/vas", icon: FileText },
      { title: "Public Pool", url: "/customers/public-pool", icon: Database },
      { title: "Tracing / Tracking", url: "/sales/tracing", icon: History },
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
    title: "Lead", icon: Layers, permKey: "Customer",
    items: [
      { title: "Lead Pools", url: "/sales/lead-pools", icon: Database },
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
    ],
  },
  {
    title: "User Reports", icon: FileText, permKey: "User Report",
    items: [
      { title: "Loan Report", url: "/reports/loan", icon: FileText },
      { title: "VAS Report", url: "/reports/vas", icon: FileText },
      { title: "GM Report", url: "/reports/gm", icon: FileText },
      { title: "BV Report", url: "/reports/bv", icon: FileText },
    ],
  },
  { title: "Training", icon: GraduationCap, url: "/training", permKey: "Training" },
  {
    title: "DRM Setting", icon: Settings, permKey: "DRM Setting",
    items: [
      { title: "Super Admin", url: "/super-admin", icon: UserCircle },
      { title: "Admin", url: "/admin", icon: UserCircle },
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
    ],
  },
  {
    title: "Office Account", icon: Wallet, permKey: "Office Account",
    items: [
      { title: "Chart of Accounts", url: "/office/chart-of-accounts", icon: BarChart3 },
      { title: "Office Expense", url: "/office/expenses", icon: Receipt },
      { title: "Business Customer", url: "/office/business-customers", icon: Building2 },
      { title: "Office VAS", url: "/office/vas", icon: TrendingUp },
      { title: "Cheque System", url: "/office/cheques", icon: CreditCard },
    ],
  },
  {
    title: "Reports & Analytics", icon: PieChart, permKey: "Reports",
    items: [
      { title: "User Activity Report", url: "/analytics/user-activity", icon: Activity },
      { title: "Ledger Report", url: "/analytics/ledger", icon: Book },
      { title: "GM Report", url: "/analytics/gm", icon: Star },
      { title: "Refund Report", url: "/analytics/refund", icon: RotateCcw },
      { title: "Invoice Report", url: "/analytics/invoice", icon: FileText },
    ],
  },
  { title: "Policies & Settings", icon: FolderOpen, url: "/policies" },
];

// Map department NAME ÔåÆ which role categories can see it
const DEPT_NAME_TO_ROLES: Record<string, string[]> = {
  "Admin": ["admin", "super_admin", "administrator", "junior_admin"],
  "Super HOD": ["admin", "super_admin", "super_hod"],
  "Head of Department": ["admin", "super_admin", "super_hod", "hod"],
  "Sales Department": ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod"],
  "Lead Department": ["admin", "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager", "hod", "super_hod"],
  "Accounts Department": ["admin", "account_manager", "accountant", "hod", "super_hod"],
  "Service Department": ["admin", "support_agent", "hod", "super_hod"],
  "Reception Department": ["admin", "support_agent", "hod", "super_hod"],
  "IT Department": ["admin", "developer", "hod", "super_hod"],
  "Software Department": ["admin", "developer", "hod", "super_hod"],
  "QA Department": ["admin", "developer", "hod", "super_hod"],
  "Verification Department": ["admin", "hod", "super_hod", "sales_manager"],
  "Complaint Department": ["admin", "support_agent", "hod", "super_hod"],
  "Marketing Department": ["admin", "hod", "super_hod"],
  "Media Department": ["admin", "hod", "super_hod"],
  "D&D Department": ["admin", "hod", "super_hod"],
  "SEO/SMM Department": ["admin", "hod", "super_hod"],
  "Product Posting": ["admin", "hod", "super_hod"],
  "Project Department": ["admin", "developer", "hod", "super_hod"],
  "Internship & Trainee": ["admin", "hod", "super_hod"],
  "Web Excels": ["admin", "super_hod"],
  "Trade Assurance": ["admin", "sales_executive", "sales_manager", "hod", "super_hod"],
};

// ÔöÇÔöÇÔöÇ Permission check: does this user's role have access? ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function hasAccess(
  menuPermissions: MenuPermission[],
  permKey: string | undefined,
  userRoleName: string | null,    // active role (e.g. "developer")
  userAllRoles: string[],          // all assigned roles
): boolean {
  if (!permKey) return true; // no restriction = always visible

  const entry = menuPermissions.find(
    (p) => p.name.toLowerCase() === permKey.toLowerCase() && p.isActive
  );
  if (!entry) return false; // not in DB or deactivated ÔåÆ hide

  const entryPerms = entry.permissions || []; // [{name, type}]
  if (entryPerms.length === 0) return true;   // no dept restrictions = visible to all

  // All roles the user has (active + assigned)
  const rolesSet = new Set([
    ...(userRoleName ? [userRoleName.toLowerCase().replace(/\s+/g, "_")] : []),
    ...userAllRoles.map(r => r.toLowerCase().replace(/\s+/g, "_")),
  ]);
  const roles = Array.from(rolesSet);

  // Admin/super_admin always have access
  if (roles.some(r => ["admin", "super_admin", "administrator"].includes(r))) return true;

  // Check if any department in this menu's permission list grants access to any of user's roles
  for (const dept of entryPerms) {
    const allowedRoles = DEPT_NAME_TO_ROLES[dept.name] || [];
    if (roles.some(r => allowedRoles.includes(r))) return true;
  }

  return false;
}

// ÔöÇÔöÇÔöÇ Component ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
export function AppSidebar() {
  const [location] = useLocation();
  const { state } = useSidebar();

  const sidebarBg = "bg-sidebar";
  const sidebarText = "text-sidebar-foreground";
  const hoverMain = "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
  const hoverSub = "hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground";
  const activeClass = "bg-sidebar-accent text-sidebar-accent-foreground";

  // ÔöÇÔöÇ Fetch live permissions from DB ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const { data: menuPermissions = [], isLoading: permsLoading } = useQuery<MenuPermission[]>({
    queryKey: ["/api/drm/permissions"],
    queryFn: async () => {
      const token = localStorage.getItem("token") || "";
      const res = await fetch("/api/drm/permissions", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 0, // Always fresh - re-fetch on every page load
    refetchOnMount: true,
  });

  // ÔöÇÔöÇ Get current user role info (reactive) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const [userRoleName, setUserRoleName] = useState<string | null>(
    () => localStorage.getItem("userRole")
  );
  const [userAllRoles, setUserAllRoles] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem("userRoles");
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  // Listen for localStorage changes (e.g. after role switch)
  useEffect(() => {
    const handleStorage = () => {
      setUserRoleName(localStorage.getItem("userRole"));
      try {
        const s = localStorage.getItem("userRoles");
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

  // ÔöÇÔöÇ Admin check helper ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const adminKeys = ["admin", "super_admin", "administrator", "adm"];

  // Read JWT directly ÔÇö most reliable source, unaffected by localStorage staleness
  const jwtPayload = (() => {
    try {
      const t = localStorage.getItem("token") || "";
      return t ? JSON.parse(atob(t.split(".")[1])) : null;
    } catch { return null; }
  })();

  const isImpersonating = !!(jwtPayload?.impersonatorId);
  const isAdminByJwt = adminKeys.includes((jwtPayload?.roleId || "").toLowerCase()) ||
    (Array.isArray(jwtPayload?.roles) && jwtPayload.roles.some((r: string) => adminKeys.includes(r.toLowerCase())));
  const isAdminByStorage = adminKeys.includes((userRoleName || "").toLowerCase().replace(/\s+/g, "_")) ||
    userAllRoles.some(r => adminKeys.includes(r.toLowerCase().replace(/\s+/g, "_")));

  const isAdmin = isImpersonating || isAdminByJwt || isAdminByStorage;

  // ÔöÇÔöÇ Filter top-level menu items ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  // NEVER hide the full sidebar during loading ÔÇö show all items optimistically,
  // then refine once permission data is available.
  const filteredItems = menuItems.filter((item) => {
    // Admin / super_admin / impersonating ÔåÆ see EVERYTHING
    if (isAdmin) return true;
    // Dashboard always visible
    if (item.title === "Dashboard") return true;
    // If permissions not loaded yet or empty, show all items (fail-open)
    if (permsLoading || menuPermissions.length === 0) return true;
    // Items with no permKey ÔÇö show to all logged-in users
    if (!item.permKey) return true;
    // Check permission from DB
    return hasAccess(menuPermissions, item.permKey, userRoleName, userAllRoles);
  });

  // ÔöÇÔöÇ Render helpers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  const renderSubItems = (items: MenuItem[]) =>
    items.map((subItem) => {
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
                        <Link href={nested.url!} data-testid={`link-${nested.title.toLowerCase().replace(/\s+/g, "-")}`}>
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
            <Link href={subItem.url!} data-testid={`link-${subItem.title.toLowerCase().replace(/\s+/g, "-")}`}>
              <subItem.icon className="w-4 h-4" />
              <span>{subItem.title}</span>
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      );
    });

  return (
    <Sidebar collapsible="icon" className={`${sidebarBg} ${sidebarText}`}>
      <SidebarContent className={`${sidebarBg} ${sidebarText}`}>
        <SidebarGroup>
          <div className={`px-4 py-4 border-b border-sidebar-border bg-sidebar`}>
            <div className="flex items-center justify-start h-16 min-h-16" style={{ maxHeight: "64px" }} data-testid="img-logo">
              <img
                src="/webexcels-logo.png"
                alt="WebExcels logo"
                className="h-[50px] w-auto max-w-full rounded bg-muted/20 px-2 py-1 object-contain"
              />
            </div>
          </div>
          <SidebarGroupContent className={`${sidebarBg} ${sidebarText}`}>
            <SidebarMenu>
              {filteredItems.map((item) => {
                // ÔöÇÔöÇ Item with sub-items ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
                                <Link key={subItem.title} href={subItem.url!}
                                  className={`flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors ${location === subItem.url ? "bg-white/20 font-medium" : ""}`}>
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
                            {renderSubItems(item.items)}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                // ÔöÇÔöÇ Single item ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
                if (state === "collapsed") {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <HoverCard openDelay={0} closeDelay={100}>
                        <HoverCardTrigger asChild>
                          <div className="w-full">
                            <SidebarMenuButton asChild className={`${sidebarText} ${hoverMain} ${location === item.url ? activeClass : ""}`}>
                              <Link href={item.url!} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
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
                            <Link href={item.url!}
                              className={`flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors ${location === item.url ? "bg-white/20 font-medium" : ""}`}>
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
                      <Link href={item.url!} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
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
