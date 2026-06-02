import { ROLES, type RoleKey } from "../utils/role-utils";

// --- Role Registry & Display Labels ---
export const ROLE_REGISTRY = [
    { key: ROLES.ACCOUNT_MANAGER, label: "Account Manager", description: "Manage client accounts and finances" },
    { key: ROLES.ADMIN, label: "Admin", description: "Full system access" },
    { key: ROLES.SUPER_HOD, label: "Super HOD", description: "Head of multiple departments" },
    { key: ROLES.HOD, label: "HOD", description: "Head of Department" },
    { key: ROLES.SALES_MANAGER, label: "Sales Manager", description: "Manage sales team and leads" },
    { key: ROLES.SALES_ASSISTANT_MANAGER, label: "Sales Assistant Manager", description: "Assist in managing sales operations" },
    { key: ROLES.JUNIOR_ADMIN, label: "Junior Admin", description: "Assistant administration and overview" },
    { key: ROLES.SALES_EXECUTIVE, label: "Sales Executive", description: "Handle leads and follow-ups" },
    { key: ROLES.DEVELOPER, label: "Developer", description: "Technical system maintenance" },
    { key: ROLES.PRODUCT_POSTING_EXECUTIVE, label: "Product Posting Executive", description: "Execute product posting tasks" },
    { key: ROLES.PRODUCT_POSTING_MANAGER, label: "Product Posting Manager", description: "Manage product posting workflows" },
<<<<<<< HEAD
    { key: ROLES.QA_MANAGER, label: "QA Manager", description: "Quality Assurance management" },
    { key: ROLES.VERIFICATION_MANAGER, label: "Verification Manager", description: "Client and data verification management" },
    { key: ROLES.DD_MANAGER, label: "D&D Manager", description: "Design & Development Department Manager" },
    { key: ROLES.DD_EXECUTIVE, label: "D&D Executive", description: "Design & Development Department Executive" },
    { key: ROLES.IT_MANAGER, label: "IT Manager", description: "Information Technology Department Manager" },
    { key: ROLES.RECEPTION_MANAGER, label: "Reception Manager", description: "Reception Department Manager" },
=======
    { key: ROLES.QA_MANAGER, label: "QA Manager", description: "Quality Assurance oversight" },
    { key: ROLES.VERIFICATION_MANAGER, label: "Verification Manager", description: "Verify operations and processes" },
    { key: ROLES.DD_MANAGER, label: "D&D Manager", description: "Manage design and development" },
    { key: ROLES.DD_EXECUTIVE, label: "D&D Executive", description: "Design and development tasks" },
    { key: ROLES.IT_MANAGER, label: "IT Manager", description: "Manage IT assets and infrastructure" },
    { key: ROLES.RECEPTION_MANAGER, label: "Reception Manager", description: "Front desk and reception ops" },
>>>>>>> bilal
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

        case ROLES.JUNIOR_ADMIN:
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
