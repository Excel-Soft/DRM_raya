import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Moon, Sun, User, LayoutDashboard, ChevronDown, Check, LayoutGrid } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { NotificationDropdown } from "./notification-dropdown";

interface TopBarProps {
  userRole: string;
  userName: string;
  onPeriodChange?: (period: string) => void;
  onThemeToggle?: () => void;
  isDark?: boolean;
  onLogout?: () => void;
  onNavigate?: (path: string) => void;
  userRoles?: string[];
}

export function TopBar({
  userRole,
  userName,
  onPeriodChange,
  onThemeToggle,
  isDark,
  onLogout,
  onNavigate,
  userRoles = [],
}: TopBarProps) {
  const [period, setPeriod] = useState(() => sessionStorage.getItem("globalPeriod") || "TD");

  // Fetch RBAC data
  const { data: navData } = useQuery({
    queryKey: ["/me/navigation"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/navigation");
      return res.json();
    },
  });

  const manageableRoles = navData?.manageableRoles || [];
  const isImpersonating = navData?.isImpersonating || sessionStorage.getItem("isImpersonating") === "true";
  // currentRole from API might be different from prop if state sync is delayed, but prop is usually fresher from App.tsx 
  // actually App.tsx fetches /api/auth/me which is what we want.

  const handleImpersonate = async (roleKey: string) => {
    try {
      // Determine if the current user is an admin
      const normalizedUserRolesList = userRoles.map(r => r.toLowerCase().replace(/\s+/g, '_'));
      const isAdmin = normalizedUserRolesList.some(r => ['admin', 'super_admin', 'adm'].includes(r))
        || ['admin', 'super_admin', 'adm'].includes(userRole.toLowerCase().replace(/\s+/g, '_'));

      let res: Response;
      if (isAdmin) {
        // Admin users: use impersonation endpoint (can become any role)
        res = await apiRequest("POST", "/api/admin/impersonate", { roleKey });
      } else {
        // Non-admin users: use set-active-role endpoint (switch between their own assigned roles)
        res = await apiRequest("POST", "/api/auth/set-active-role", { roleId: roleKey });
      }

      const data = await res.json();
      if (data.success && data.token) {
        // Save the new token
        sessionStorage.setItem("token", data.token);
        // Update role in sessionStorage for immediate UI feedback
        sessionStorage.setItem("userRole", data.actingRole || roleKey);
        // Prevent queryClient from wiping the token during reload
        sessionStorage.setItem("roleSwitchInProgress", Date.now().toString());
        
        // Track impersonation state
        if (isAdmin) {
          sessionStorage.setItem("isImpersonating", "true");
        } else {
          sessionStorage.removeItem("isImpersonating");
        }

        // Redirect to appropriate dashboard based on role
        const roleDashboards: Record<string, string> = {
          sales_manager: "/dashboard/sales-manager",
          sales_assistant_manager: "/dashboard/sales-assistant-manager",
          sales_executive: "/dashboard/sales-executive",
          account_manager: "/dashboard/account-manager",
          service_manager: "/dashboard/service-manager",
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
          developer: "/dashboard/software-executive",
          software_manager: "/dashboard/software-manager",
          software_executive: "/dashboard/software-executive",
          lead_manager: "/dashboard/lead-manager",
          seo_smm_manager: "/dashboard/seo-smm",
          marketing_manager: "/dashboard/marketing-manager",
        };

        const targetDashboard = roleDashboards[roleKey] || "/";
        if (window.location.pathname === targetDashboard) {
          window.location.reload();
        } else {
          window.location.href = targetDashboard;
        }
      } else {
        console.error("Role switch failed:", data);
        alert(data.message || data.error || "Failed to switch role. Please try again.");
      }
    } catch (err) {
      console.error("Role switch failed", err);
      alert("Failed to switch role. Please try again.");
    }
  };

  const handleStopImpersonation = async () => {
    try {
      const res = await apiRequest("POST", "/api/admin/impersonate/stop");
      const data = await res.json();
      if (data.success && data.token) {
        // Save the fresh admin token and clear impersonation state
        sessionStorage.setItem("token", data.token);
        sessionStorage.removeItem("isImpersonating");
        sessionStorage.setItem("roleSwitchInProgress", Date.now().toString());
        window.location.reload();
      } else {
        sessionStorage.removeItem("isImpersonating");
        window.location.reload();
      }
    } catch (err) {
      console.error("Stop impersonation failed", err);
      alert("Failed to stop impersonation. Please try again.");
    }
  };

  const handlePeriodChange = (value: string) => {
    setPeriod(value);
    sessionStorage.setItem("globalPeriod", value);
    window.dispatchEvent(new Event("storage"));
    onPeriodChange?.(value);
  };

  return (
    <header className="flex items-center justify-between gap-4 bg-background px-4 py-3">
      <div className="flex items-center gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" />

        {/* Role Switcher */}
        {/* Show dropdown for all users to allow role switching */}
        {true ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 px-2 hover:bg-accent/50 h-9" data-testid="role-switcher-trigger">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Role:</span>
                <Badge variant="secondary" className={cn("gap-1 border-primary/10 px-3 py-1 text-[10px] font-black", isImpersonating && "bg-blue-600 text-white hover:bg-blue-700 shadow-sm")}>
                  {isImpersonating ? `Acting as: ${userRole}` : userRole}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel className="text-xs font-bold uppercase text-muted-foreground/60">Switch Role</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(() => {
                const normalizedUserRoles = userRoles.map(r => r.toLowerCase().replace(/\s+/g, '_'));
                const isAdminBysessionStorage = normalizedUserRoles.some(r => ['admin', 'super_admin', 'adm'].includes(r))
                  || ['admin', 'super_admin', 'adm'].includes(userRole.toLowerCase().replace(/\s+/g, '_'));

                const DEFAULT_MANAGEABLE_ROLES = [
                  { key: "sales_manager", label: "Sales Manager" },
                  { key: "sales_assistant_manager", label: "Sales Assistant Manager" },
                  { key: "sales_executive", label: "Sales Executive" },
                  { key: "service_manager", label: "Service Manager" },
                  { key: "service_assistant_manager", label: "Service Assistant Manager" },
                  { key: "service_executive", label: "Service Executive" },
                  { key: "super_hod", label: "Super HOD" },
                  { key: "hod", label: "HOD" },
                  { key: "account_manager", label: "Account Manager" },
                  { key: "developer", label: "Developer" },
                  { key: "qa_manager", label: "QA Manager" },
                  { key: "verification_manager", label: "Verification Manager" },
                  { key: "product_posting_manager", label: "Product Posting Manager" },
                  { key: "product_posting_executive", label: "Product Posting Executive" },
                  { key: "posting_executive", label: "Posting Executive" },
                  { key: "dd_manager", label: "D&D Manager" },
                  { key: "dd_executive", label: "D&D Executive" },
                  { key: "it_manager", label: "IT Manager" },
                  { key: "reception_manager", label: "Reception Manager" },
                  { key: "seo_smm_manager", label: "SEO/SMM Manager" },
                  { key: "software_manager", label: "Software Manager" },
                  { key: "software_executive", label: "Software Executive" },
                  { key: "lead_manager", label: "Lead Manager" },
                  { key: "lead_executive", label: "Lead Executive" },
                  { key: "marketing_manager", label: "Marketing Manager" },
                ];

                const effectiveManageableRoles = manageableRoles.length > 0 ? manageableRoles : (isAdminBysessionStorage || isImpersonating ? DEFAULT_MANAGEABLE_ROLES : []);

                // Show all manageable roles if:
                // 1. User is admin (locally), OR
                // 2. Currently impersonating (server already verified admin)
                const showAllRoles = (isAdminBysessionStorage || isImpersonating) && effectiveManageableRoles.length > 0;

                if (showAllRoles) {
                  return effectiveManageableRoles.map((role: any) => (
                    <DropdownMenuItem
                      key={role.key}
                      onSelect={() => handleImpersonate(role.key)}
                      className="flex items-center justify-between"
                    >
                      <span>{role.label}</span>
                      {userRole.toLowerCase() === role.key && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  ));
                }

                // For non-admin users: only show their assigned roles
                if (effectiveManageableRoles.length > 0) {
                  const filtered = effectiveManageableRoles.filter((role: any) =>
                    normalizedUserRoles.includes(role.key.toLowerCase().replace(/\s+/g, '_'))
                  );
                  return filtered.map((role: any) => (
                    <DropdownMenuItem
                      key={role.key}
                      onSelect={() => handleImpersonate(role.key)}
                      className="flex items-center justify-between"
                    >
                      <span>{role.label}</span>
                      {userRole.toLowerCase() === role.key && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  ));
                }

                // Fallback: show only the user's assigned roles
                return userRoles.map(r => {
                  const key = r.toLowerCase().replace(/\s+/g, '_');
                  const label = r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <DropdownMenuItem key={key} onSelect={() => handleImpersonate(key)}>
                      <span>{label}</span>
                      {userRole.toLowerCase() === key && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  );
                });
              })()}
              {isImpersonating && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={handleStopImpersonation}
                    className="text-destructive focus:text-destructive"
                  >
                    Stop Impersonation
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase">Role:</span>
            <Badge variant="secondary" className="text-[10px] font-black" data-testid="badge-user-role">{userRole}</Badge>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="p-2" data-testid="button-dashboards">
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => onNavigate?.("/")}>Main Dashboard</DropdownMenuItem>
            {(() => {
              const normalizedRoles = userRoles.map(r => r.toLowerCase().replace(/\s+/g, '_'));
              // ONLY admin/super_admin see all dashboards
              const isAdmin = normalizedRoles.some(r => ['admin', 'super_admin', 'adm'].includes(r))
                || ['admin', 'super_admin', 'adm'].includes(userRole.toLowerCase().replace(/\s+/g, '_'));
              const dashboards = [
                { label: "HOD Dashboard", path: "/dashboard/hod", roles: ['hod'] },
                { label: "Super HOD Dashboard", path: "/dashboard/super-hod", roles: ['super_hod'] },
                { label: "D&D Manager", path: "/dashboard/dd-manager", roles: ['manager', 'dd_manager'] },
                { label: "D&D Executive", path: "/dashboard/dd-executive", roles: ['executive', 'dd_executive'] },
                { label: "Account Manager", path: "/dashboard/account-manager", roles: ['account_manager'] },
                { label: "Sales Manager", path: "/dashboard/sales-manager", roles: ['manager', 'sales_manager'] },
                { label: "Sales Assistant Manager", path: "/dashboard/sales-assistant-manager", roles: ['manager', 'sales_assistant_manager'] },
                { label: "Sales Executive", path: "/dashboard/sales-executive", roles: ['sales_executive'] },
                { label: "Product Posting", path: "/product-posting/manager", roles: ['manager', 'product_posting_manager'] },
                { label: "Posting Executive", path: "/product-posting/executive", roles: ['executive', 'product_posting_executive', 'posting_executive'] },
                { label: "QA Manager", path: "/qa/manager", roles: ['manager', 'qa_manager'] },
                { label: "Verification Manager", path: "/verification/manager", roles: ['manager', 'verification_manager'] },
                { label: "IT Manager", path: "/dashboard/it-manager", roles: ['it_manager'] },
                { label: "Reception Manager", path: "/dashboard/reception", roles: ['reception_manager', 'reception'] },
                { label: "Service Manager", path: "/dashboard/service-manager", roles: ['service_manager', 'service', 'admin', 'manager'] },
                { label: "Service Assistant Manager", path: "/dashboard/service-assistant-manager", roles: ['service_assistant_manager', 'service', 'admin', 'manager'] },
                { label: "Service Executive", path: "/dashboard/service-executive", roles: ['service_executive', 'service', 'admin', 'manager'] },
                { label: "SEO/SMM Manager", path: "/dashboard/seo-smm", roles: ['manager', 'seo_manager', 'admin', 'seo_smm_manager'] },
                { label: "Lead Manager", path: "/dashboard/lead-manager", roles: ['manager', 'sales_manager', 'admin', 'lead_manager', 'software_manager'] },
                { label: "Lead Executive", path: "/dashboard/lead-executive", roles: ['executive', 'sales_executive', 'admin', 'lead_executive'] },
                { label: "Software Manager", path: "/dashboard/software-manager", roles: ['manager', 'it_manager', 'admin', 'software_manager'] },
                { label: "Software Executive", path: "/dashboard/software-executive", roles: ['developer', 'admin', 'software_manager', 'software_executive'] },
                { label: "Marketing Manager", path: "/dashboard/marketing-manager", roles: ['manager', 'marketing_manager', 'admin'] },
              ];
              return dashboards
                .filter(d => isAdmin || d.roles.some(r => normalizedRoles.includes(r)))
                .map(d => (
                  <DropdownMenuItem key={d.path} onSelect={() => onNavigate?.(d.path)}>
                    {d.label}
                  </DropdownMenuItem>
                ));
            })()}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-32 text-sm h-9" data-testid="select-time-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TD">Today</SelectItem>
            <SelectItem value="WC">Weekly</SelectItem>
            <SelectItem value="MN">Monthly</SelectItem>
            <SelectItem value="QT">Quarterly</SelectItem>
            <SelectItem value="YR">Yearly</SelectItem>
          </SelectContent>
        </Select>

        <NotificationDropdown />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            onThemeToggle?.();
          }}
          data-testid="button-theme-toggle"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="button-user-menu">
              <User className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel data-testid="text-user-name" className="text-sm font-bold">{userName}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="button-profile">Profile</DropdownMenuItem>
            <DropdownMenuItem data-testid="button-settings">Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem data-testid="button-logout" onSelect={() => onLogout?.()}>
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
