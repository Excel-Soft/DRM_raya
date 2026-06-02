/**
 * Normalizes role string to a consistent format (lowercase, underscored)
 */
export function normalizeRole(roleId: string | null | undefined): string {
    if (!roleId) return "";
    return roleId.toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * Checks if a given role is a managerial role
 */
export function isManagerialRole(roleId: string | null | undefined): boolean {
    if (!roleId) return false;
    const normalized = normalizeRole(roleId);
    const managerialRoles = [
        "admin",
        "super_hod",
        "hod",
        "manager",
        "assistant_manager",
        "service_manager",
        "qa_manager",
        "verification_manager",
        "product_posting_manager",
        "dd_manager",
        "brand_and_design_manager"
    ];
    return managerialRoles.includes(normalized);
}

/**
 * Checks if a given role is a sales-related role
 */
export function isSalesRole(roleId: string | null | undefined): boolean {
    if (!roleId) return false;
    const normalized = normalizeRole(roleId);
    const salesRoles = ["sales_executive", "support_agent", "verification_executive", "product_posting_executive", "posting_executive"];
    return salesRoles.includes(normalized);
}

/**
 * Checks if a given role is a production/design role 
 */
export function isProductionRole(roleId: string | null | undefined): boolean {
    if (!roleId) return false;
    const normalized = normalizeRole(roleId);
    const productionRoles = ["dd_executive", "listing_executive"];
    return productionRoles.includes(normalized);
}
