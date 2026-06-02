import { ROLES, type RoleKey } from "../utils/role-utils";

// --- Role Registry & Display Labels ---
export const ROLE_REGISTRY = [
    { key: ROLES.ACCOUNT_MANAGER, label: "Account Manager", description: "Manage client accounts and finances" },
    { key: ROLES.ADMIN, label: "Admin", description: "Full system access" },
    { key: ROLES.SUPER_HOD, label: "Super HOD", description: "Head of multiple departments" },
    { key: ROLES.HOD, label: "HOD", description: "Head of Department" },
    { key: ROLES.SALES_MANAGER, label: "Sales Manager", description: "Manage sales team and leads" },
    { key: ROLES.SALES_ASSISTANT_MANAGER, label: "Sales Assistant Manager", description: "Assist in managing sales operations" },
    { key: ROLES.SALES_EXECUTIVE, label: "Sales Executive", description: "Handle leads and follow-ups" },
    { key: ROLES.SERVICE_MANAGER, label: "Service Manager", description: "Assistant administration and overview" },
    { key: ROLES.SERVICE_ASSISTANT_MANAGER, label: "Service Assistant Manager", description: "Assist in managing service operations" },
    { key: ROLES.SERVICE_EXECUTIVE, label: "Service Executive", description: "Handle service tasks and tickets" },
    { key: ROLES.DEVELOPER, label: "Developer", description: "Technical system maintenance" },
    { key: ROLES.PRODUCT_POSTING_EXECUTIVE, label: "Product Posting Executive", description: "Execute product posting tasks" },
    { key: ROLES.PRODUCT_POSTING_MANAGER, label: "Product Posting Manager", description: "Manage product posting workflows" },
    { key: ROLES.QA_MANAGER, label: "QA Manager", description: "Quality Assurance management" },
    { key: ROLES.VERIFICATION_MANAGER, label: "Verification Manager", description: "Client and data verification management" },
    { key: ROLES.DD_MANAGER, label: "D&D Manager", description: "Design & Development Department Manager" },
    { key: ROLES.DD_EXECUTIVE, label: "D&D Executive", description: "Design & Development Department Executive" },
    { key: ROLES.IT_MANAGER, label: "IT Manager", description: "Information Technology Department Manager" },
    { key: ROLES.RECEPTION_MANAGER, label: "Reception Manager", description: "Manage front desk and inquiries" },
    { key: ROLES.SEO_SMM_MANAGER, label: "SEO/SMM Manager", description: "Manage SEO/SMM campaigns and reports" },
    { key: ROLES.SOFTWARE_MANAGER, label: "Software Manager", description: "Manage software project execution and team" },
    { key: ROLES.SOFTWARE_EXECUTIVE, label: "Software Executive", description: "Handle software development tasks and client communication" },
    { key: ROLES.LEAD_MANAGER, label: "Lead Manager", description: "Manage lead department and distribution" },
    { key: ROLES.LEAD_EXECUTIVE, label: "Lead Executive", description: "Lead Department Executive" },
    { key: ROLES.MARKETING_MANAGER, label: "Marketing Manager", description: "Manage marketing strategies and operations" },
] as const;

// --- Navigation Item Interface ---
export interface NavigationItem {
    title: string;
    href?: string;
    icon?: string;
    children?: NavigationItem[];
    badge?: string;
}

// --- Menu Definitions ---
const COMMON_MENUS: NavigationItem[] = [
    { title: "Dashboard", href: "/dashboard", icon: "layout-dashboard" },
    { title: "Settings", href: "/settings", icon: "settings" },
];

const SALES_MENUS: NavigationItem[] = [
    { title: "Leads", href: "/leads", icon: "users" },
    { title: "Team Performance", href: "/sales/team-performance", icon: "bar-chart-2" },
    { title: "Sales Reports", href: "/sales/reports", icon: "file-text" },
];

const SALES_EXECUTIVE_MENUS: NavigationItem[] = [
    { title: "My Leads", href: "/leads/my", icon: "users" },
    { title: "Follow Ups", href: "/follow-ups", icon: "phone-call" },
    {
        title: "PMS",
        icon: "folder-kanban",
        children: [
            { title: "Task Templates", href: "/pms/task-templates", icon: "file-text" },
            { title: "Task Creation", href: "/pms/tasks/create", icon: "plus-circle" },
            { title: "Project Status", href: "/pms/projects", icon: "bar-chart-2" },
            { title: "Running Projects", href: "/pms/running-projects", icon: "briefcase" },
            { title: "Pending Approvals", href: "/pms/approvals", icon: "clock" },
            { title: "Task History", href: "/pms/tasks", icon: "history" },
            { title: "Team Workspace", href: "/pms/workspace", icon: "users" },
        ]
    },
];

const ACCOUNT_MENUS: NavigationItem[] = [
    { title: "Clients", href: "/accounts/clients", icon: "briefcase" },
    { title: "Invoices", href: "/accounts/invoices", icon: "file-text" },
    { title: "Renewals", href: "/accounts/renewals", icon: "refresh-cw" },
];

const DEVELOPER_MENUS: NavigationItem[] = [
    { title: "Projects", href: "/projects", icon: "folder" },
    { title: "Tickets", href: "/tickets", icon: "ticket" },
    { title: "Deployments", href: "/deployments", icon: "rocket" },
];

const ADMIN_MENUS: NavigationItem[] = [
    { title: "Users", href: "/admin/users", icon: "users" },
    { title: "Roles & Permissions", href: "/admin/roles", icon: "shield" },
    { title: "Audit Logs", href: "/admin/audit-logs", icon: "activity" },
];

const ATTENDANCE_MENUS: NavigationItem[] = [
    { title: "Attendance", href: "/hr/attendance", icon: "clock" },
    { title: "Leave Request", href: "/hr/leave-request", icon: "calendar" },
];

const USER_REPORT_MENUS: NavigationItem[] = [
    { title: "User Reports", href: "/reports/loan", icon: "file-text" },
];

const TRAINING_MENUS: NavigationItem[] = [
    { title: "Training", href: "/training", icon: "graduation-cap" },
];

const NOTICE_MENUS: NavigationItem[] = [
    {
        title: "Notice",
        icon: "inbox",
        children: [
            { title: "Notice Board", href: "/notice-board", icon: "clipboard-list" },
            { title: "DRM Policies", href: "/policies", icon: "shield-check" },
        ]
    }
];

// --- Navigation Builder ---
export function getNavigationForRole(role: RoleKey, isAdmin: boolean = false): NavigationItem[] {
    const menus: NavigationItem[] = [...COMMON_MENUS];

    switch (role) {
        case ROLES.ADMIN:
            // Admin sees Admin menus + Role Navigator
            menus.splice(1, 0, ...ADMIN_MENUS); // Insert after Dashboard

            // Role Navigator
            const roleNavigator: NavigationItem = {
                title: "Role Navigator",
                icon: "compass",
                children: ROLE_REGISTRY.filter(r => r.key !== ROLES.ADMIN).map(r => ({
                    title: `${r.label} View`,
                    href: `/admin/impersonate/${r.key}`, // Frontend can intercept this link
                }))
            };
            menus.push(roleNavigator);

            // Admin also gets domain menus for quick access? 
            // User context said "Admin menus: Users, Roles..., plus domain menus"
            menus.push(
                { title: "Sales", children: SALES_MENUS },
                { title: "Accounts", children: ACCOUNT_MENUS },
                { title: "Development", children: DEVELOPER_MENUS }
            );
            break;

        case ROLES.SALES_MANAGER:
        case ROLES.SALES_ASSISTANT_MANAGER:
            menus.push(...SALES_MENUS);
            break;

        case ROLES.SERVICE_MANAGER:
            menus.splice(1, 0, ...ADMIN_MENUS); // Junior Admin sees admin tools
            break;

        case ROLES.SALES_EXECUTIVE:
            menus.push(...SALES_EXECUTIVE_MENUS);
            break;

        case ROLES.ACCOUNT_MANAGER:
            menus.push(...ACCOUNT_MENUS);
            break;

        case ROLES.DEVELOPER:
            menus.push(...DEVELOPER_MENUS);
            break;

        case ROLES.PRODUCT_POSTING_EXECUTIVE:
        case ROLES.PRODUCT_POSTING_MANAGER:
            // For now, these share a similar set of tools in the dashboard
            menus.push({ title: "Product Posting", href: "/product-posting", icon: "clipboard-list" });
            break;

        // Legacy support
        case ROLES.HOD:
        case ROLES.SUPER_HOD:
            menus.push(...SALES_MENUS);
            menus.splice(1, 0, ...ADMIN_MENUS); // Head of departments also see admin overview
            break;

        case ROLES.RECEPTION_MANAGER:
        case ROLES.SEO_SMM_MANAGER:
        case ROLES.MARKETING_MANAGER:
            menus.push(
                ...SALES_MENUS,
                { title: "PMS", children: SALES_EXECUTIVE_MENUS.find(m => m.title === "PMS")?.children || [] },
                ...ATTENDANCE_MENUS,
                ...USER_REPORT_MENUS,
                ...TRAINING_MENUS,
                ...NOTICE_MENUS
            );
            break;
        case ROLES.SOFTWARE_MANAGER:
        case ROLES.SOFTWARE_EXECUTIVE:
        case ROLES.LEAD_MANAGER:
            menus.push(
                ...SALES_MENUS,
                { title: "PMS", children: SALES_EXECUTIVE_MENUS.find(m => m.title === "PMS")?.children || [] },
                ...ATTENDANCE_MENUS,
                ...USER_REPORT_MENUS,
                ...TRAINING_MENUS,
                ...NOTICE_MENUS
            );
            break;
    }

    return menus;
}

// --- Permission Helpers (Placeholder) ---
// In a real app, this would query the DB for `role_permissions`.
// For now, we can hardcode key permissions or load them.
export const PERMISSIONS = {
    ADMIN_ALL: "admin:*",
    USERS_READ: "users:read",
    USERS_WRITE: "users:write",
    // ... add more as needed
};
