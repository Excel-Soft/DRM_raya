import {
  canShowAuditLogsNav,
  DRM_IP_LIST_ROUTE,
  isRouteAccessAllowed,
} from "@/lib/auth/route-access";
import {
  DASHBOARD_NOTICE_BOARD,
  DASHBOARD_POLICIES,
  DASHBOARD_TRAINING,
} from "./dashboard-routes";
import { DRM_ADMIN, DRM_BOT_SYSTEM, DRM_FB_POST, DRM_ONLINE_FORM, DRM_SUPER_ADMIN } from "./drm-routes";
import type { NavGroup, NavLinkItem } from "./navigation-config";
import { hasMenuPermAccess } from "./menu-perm-roles";
import { isBotSystemEnabled, isFbPostEnabled, isOnlineFormEnabled } from "@/lib/feature-flags";

function hrefVisible(
  href: string,
  activeRoleId: string | null | undefined,
  userRoles: string[] | undefined,
  permKey?: string,
): boolean {
  if (href === "/dashboard/audit-logs") {
    return canShowAuditLogsNav(activeRoleId, userRoles);
  }

  if (href === DASHBOARD_NOTICE_BOARD) {
    return (
      hasMenuPermAccess("Notice Board", activeRoleId, userRoles) &&
      isRouteAccessAllowed(href, activeRoleId, userRoles)
    );
  }

  if (href === DASHBOARD_POLICIES) {
    return (
      hasMenuPermAccess("DRM Policies", activeRoleId, userRoles) &&
      isRouteAccessAllowed(href, activeRoleId, userRoles)
    );
  }

  if (href === DASHBOARD_TRAINING) {
    return (
      hasMenuPermAccess("Training", activeRoleId, userRoles) &&
      isRouteAccessAllowed(href, activeRoleId, userRoles)
    );
  }

  if (href === DRM_IP_LIST_ROUTE || href.startsWith("/dashboard/allowed-ip")) {
    return (
      hasMenuPermAccess("Allowed IP", activeRoleId, userRoles) &&
      isRouteAccessAllowed(href, activeRoleId, userRoles)
    );
  }

  if (href === "/dashboard") return true;

  if (permKey === "Customer" || href.startsWith("/dashboard/sales/") || href.startsWith("/dashboard/customers/") || href.startsWith("/dashboard/customer/") || href.startsWith("/dashboard/gm-pool/") || href === "/dashboard/reports/in-service") {
    return (
      hasMenuPermAccess("Customer", activeRoleId, userRoles) &&
      isRouteAccessAllowed(href, activeRoleId, userRoles)
    );
  }

  if (href === DRM_BOT_SYSTEM && !isBotSystemEnabled()) return false;
  if (href === DRM_ONLINE_FORM && !isOnlineFormEnabled()) return false;
  if (href === DRM_FB_POST && !isFbPostEnabled()) return false;

  if (permKey === "Users" || href.startsWith("/dashboard/drm/users/")) {
    return (
      hasMenuPermAccess("Users", activeRoleId, userRoles) &&
      isRouteAccessAllowed(href, activeRoleId, userRoles)
    );
  }

  if (
    href.startsWith("/dashboard/drm/") ||
    href === DRM_SUPER_ADMIN ||
    href === DRM_ADMIN
  ) {
    const menuKey = permKey === "Admin" ? "Admin" : "DRM Setting";
    return (
      hasMenuPermAccess(menuKey, activeRoleId, userRoles) &&
      isRouteAccessAllowed(href, activeRoleId, userRoles)
    );
  }

  if (!hasMenuPermAccess(permKey, activeRoleId, userRoles)) return false;
  return isRouteAccessAllowed(href, activeRoleId, userRoles);
}

export function isNavLinkVisible(
  item: NavLinkItem,
  activeRoleId: string | null | undefined,
  userRoles: string[] | undefined,
  authenticated: boolean,
): boolean {
  if (!authenticated) return false;
  return hrefVisible(item.href, activeRoleId, userRoles, item.permKey);
}

export function isNavGroupVisible(
  group: NavGroup,
  activeRoleId: string | null | undefined,
  userRoles: string[] | undefined,
  authenticated: boolean,
): boolean {
  if (!authenticated) return false;
  if (group.children?.length) {
    return group.children.some((c) => isNavLinkVisible(c, activeRoleId, userRoles, true));
  }
  if (!group.href) return hasMenuPermAccess(group.permKey, activeRoleId, userRoles);
  return hrefVisible(group.href, activeRoleId, userRoles, group.permKey);
}

export function filterVisibleNavGroups(
  groups: NavGroup[],
  activeRoleId: string | null | undefined,
  userRoles: string[] | undefined,
  authenticated: boolean,
): NavGroup[] {
  return groups
    .filter((g) => isNavGroupVisible(g, activeRoleId, userRoles, authenticated))
    .map((g) => ({
      ...g,
      children: g.children?.filter((c) => isNavLinkVisible(c, activeRoleId, userRoles, authenticated)),
    }));
}

export function isNavPathActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/dashboard/";
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
