/**
 * Normalizes role string to a consistent format (lowercase, underscored)
 */
export function normalizeRole(roleId: string | null | undefined): string {
    if (!roleId) return "";
    return roleId
        .toLowerCase()
        .trim()
        .replace(/d\s*&\s*d/g, 'dd') // 'd & d' / 'd&d' -> 'dd'
        .replace(/&/g, '')
        .replace(/[\s-]+/g, '_')      // spaces AND hyphens -> '_'
        .replace(/_+/g, '_')
        .replace(/(^|_)d_?n_?d(?=_|$)/g, '$1dd') // 'dnd' / 'd_n_d' -> 'dd'
        .replace(/(^|_)d_d(?=_|$)/g, '$1dd');    // 'd_d' (incl former 'd-d') -> 'dd'
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
        "sales_manager",
        "sales_assistant_manager",
        "assistant_manager",
        "service_manager",
        "service_assistant_manager",
        "account_manager",
        "qa_manager",
        "verification_manager",
        "product_posting_manager",
        "dd_manager",
        "it_manager",
        "reception_manager",
        "seo_smm_manager",
        "software_manager",
        "lead_manager",
        "marketing_manager",
        "complaint_manager",
        "brand_and_design_manager"
    ];
    return managerialRoles.includes(normalized);
}

/**
 * Roles that should see data for the WHOLE company, not just their own team
 * (used by reports like Loan Report's "company-wide" view).
 */
export function isCompanyWideRole(roleId: string | null | undefined): boolean {
    if (!roleId) return false;
    const normalized = normalizeRole(roleId);
    return ["admin", "super_admin", "super_hod", "hod", "account_manager"].includes(normalized);
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
