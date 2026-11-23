import { pool } from "../db";

/**
 * Legacy drm-attributes UI mapping (webexcels.pk): sidebar labels did not always
 * match migration refId names. Example: "Company Detail" listed business types
 * (refId 1), while "Company Business Type" listed partner company names (refId 4).
 */
export const ATTRIBUTE_UI_SOURCES: Record<
    string,
    { modernCategories: string[]; refIds: string[]; excludeMigratedRefIds?: string[] }
> = {
    "Alibaba Packages": { modernCategories: [], refIds: [] },
    "Donation Head": { modernCategories: ["Donation Head"], refIds: ["9"] },
    "Company Detail": { modernCategories: ["Company Business Type"], refIds: ["1"] },
    // Legacy drm-attributes "Service Type" = refId 3 service catalog rows (not industry refId 2/7).
    "Service Type": {
        modernCategories: ["Service Type"],
        refIds: ["3"],
        excludeMigratedRefIds: ["2", "7"],
    },
  // Legacy "RC Link" = refId 4 partner URLs; migrated into modern category Company Detail.
    "RC Link": { modernCategories: ["Company Detail"], refIds: ["4"] },
    Source: { modernCategories: ["Source"], refIds: ["5"] },
    "Job Designation": { modernCategories: ["Job Designation"], refIds: ["6"] },
    "Contact Attribute": { modernCategories: ["Contact Attribute"], refIds: ["8"] },
    "Whatsapp Message": {
        modernCategories: ["Whatsapp Message"],
        refIds: [],
        excludeMigratedRefIds: ["9"],
    },
    "Company Branch": { modernCategories: ["Company Branch", "Legacy Branch"], refIds: ["10"] },
    "Govt Leave": { modernCategories: ["Govt Leave"], refIds: ["11"] },
    "Account Monthly Task": { modernCategories: ["Account Monthly Task"], refIds: ["12"] },
    "Portfolio Categories": { modernCategories: [], refIds: [] },
    "Penalty Head": { modernCategories: ["Penalty Head"], refIds: [] },
    Country: { modernCategories: ["Country"], refIds: ["14"] },
};

/** Where new rows are stored in drm.attributes (may differ from sidebar label). */
export const ATTRIBUTE_STORAGE_CATEGORY: Record<string, string> = {
    "Company Detail": "Company Business Type",
    "RC Link": "Company Detail",
};

export function resolveAttributeStorageCategory(sidebarCategory: string): string {
    return ATTRIBUTE_STORAGE_CATEGORY[sidebarCategory] ?? sidebarCategory;
}

export function resolveAttributeUiSources(sidebarCategory: string) {
    return (
        ATTRIBUTE_UI_SOURCES[sidebarCategory] ?? {
            modernCategories: [sidebarCategory],
            refIds: [],
        }
    );
}

const LEGACY_MISFILE_IDS = ["197", "198"];

export type AttributeListRow = {
    id: string;
    category: string;
    name: string;
    parentId: string | null;
    amount: string | null;
    dateLabel: string | null;
    branch: string | null;
    email: string | null;
    phone: string | null;
    createdAt: Date | string;
    updatedAt?: Date | string;
    legacyReadOnly?: boolean;
};

export async function fetchLegacyQaRows(): Promise<AttributeListRow[]> {
    const { rows } = await pool.query<{
        legacy_pk: string;
        qid: string;
        detail: string;
    }>(`
      SELECT
        _legacy_pk::text AS legacy_pk,
        trim(coalesce(qid, '0')) AS qid,
        trim(detail) AS detail
      FROM legacy_archive.webxl_questions
      WHERE nullif(trim(detail), '') IS NOT NULL
      ORDER BY _legacy_pk::int ASC
    `);

    return rows.map((row) => ({
        id: `legacy-question-${row.legacy_pk}`,
        category: "Q & A",
        name: row.detail,
        parentId: row.qid === "0" ? null : `legacy-question-${row.qid}`,
        amount: null,
        dateLabel: null,
        branch: null,
        email: null,
        phone: null,
        createdAt: new Date(0),
        legacyReadOnly: true,
    }));
}

export async function filterModernRowsForSidebar<T extends { id: string }>(
    sidebarCategory: string,
    modernRows: T[],
): Promise<T[]> {
    const { excludeMigratedRefIds } = resolveAttributeUiSources(sidebarCategory);
    if (!excludeMigratedRefIds?.length || modernRows.length === 0) return modernRows;

    const { rows } = await pool.query<{ modern_id: string }>(
        `
      SELECT m.modern_id::text AS modern_id
      FROM migration_meta.migration_legacy_ids m
      JOIN legacy_archive.webxl_attribute la ON la._legacy_pk::text = m.legacy_id
      WHERE m.legacy_table = 'webxl_attribute'
        AND m.entity_type = 'attribute_row'
        AND trim(la."refId") = ANY($1::text[])
    `,
        [excludeMigratedRefIds],
    );
    const exclude = new Set(rows.map((r) => r.modern_id));
    return modernRows.filter((row) => !exclude.has(row.id));
}

export async function fetchLegacyWhatsappRows(): Promise<AttributeListRow[]> {
    const { rows } = await pool.query<{ legacy_pk: string; title: string | null; message: string | null }>(`
      SELECT
        _legacy_pk::text AS legacy_pk,
        nullif(trim(title), '') AS title,
        nullif(trim(message), '') AS message
      FROM legacy_archive.webxl_whatsapp
      ORDER BY _legacy_pk::int ASC
    `);
    return rows.map((row) => ({
        id: `legacy-whatsapp-${row.legacy_pk}`,
        category: "Whatsapp Message",
        name: row.title ?? (row.message ? row.message.slice(0, 160) : "Message"),
        parentId: null,
        amount: null,
        dateLabel: null,
        branch: null,
        email: null,
        phone: null,
        createdAt: new Date(0),
        legacyReadOnly: true,
    }));
}

export async function fetchLegacyPenaltyHeadRows(): Promise<AttributeListRow[]> {
    const { rows } = await pool.query<{ legacy_pk: string; head: string; amount: string | null }>(`
      SELECT _legacy_pk::text AS legacy_pk, trim(head) AS head, nullif(trim(amount), '') AS amount
      FROM legacy_archive.webxl_penalty_head
      WHERE nullif(trim(head), '') IS NOT NULL
      ORDER BY _legacy_pk::int ASC
    `);
    return rows.map((row) => ({
        id: `legacy-penalty-${row.legacy_pk}`,
        category: "Penalty Head",
        name: row.head,
        parentId: null,
        amount: row.amount,
        dateLabel: null,
        branch: null,
        email: null,
        phone: null,
        createdAt: new Date(0),
        legacyReadOnly: true,
    }));
}

export async function fetchLegacyBuyerDetailRows(): Promise<AttributeListRow[]> {
    const { rows } = await pool.query<{
        legacy_pk: string;
        legacy_id: string;
        ref_id: string;
        user_id: string | null;
        buyer_from: string | null;
        paypal_email: string | null;
        mobile: string | null;
        user_name: string | null;
    }>(`
      SELECT
        b._legacy_pk::text AS legacy_pk,
        trim(b.id) AS legacy_id,
        trim(coalesce(b.ref_id, '0')) AS ref_id,
        nullif(trim(b.user_id), '') AS user_id,
        nullif(trim(b.buyer_from), '') AS buyer_from,
        nullif(trim(b.paypal_email), '') AS paypal_email,
        nullif(trim(b.mobile), '') AS mobile,
        nullif(trim(u.name), '') AS user_name
      FROM legacy_archive.webxl_dollar_buyer b
      LEFT JOIN legacy_archive.webxl_user u ON u._legacy_pk::text = trim(b.user_id)
      ORDER BY b._legacy_pk::int ASC
    `);

    const buyerIdToPk = new Map(rows.map((r) => [r.legacy_id, r.legacy_pk]));
    // Legacy links child rows via parent user_id (ref_id), not buyer row id.
    const buyerUserToPk = new Map<string, string>();
    for (const row of rows) {
        if (row.ref_id === "0" && row.user_id) {
            buyerUserToPk.set(row.user_id, row.legacy_pk);
        }
    }

    return rows.map((row) => {
        const isRoot = row.ref_id === "0";
        const parentPk = !isRoot
            ? buyerUserToPk.get(row.ref_id) ?? buyerIdToPk.get(row.ref_id) ?? null
            : null;
        const name = isRoot
            ? row.user_name ?? row.buyer_from ?? row.paypal_email ?? `Buyer ${row.legacy_pk}`
            : row.buyer_from ?? row.user_name ?? row.paypal_email ?? row.mobile ?? `Reference ${row.legacy_pk}`;
        return {
            id: `legacy-buyer-${row.legacy_pk}`,
            category: "Buyer Detail",
            name,
            parentId: parentPk ? `legacy-buyer-${parentPk}` : null,
            amount: null,
            dateLabel: null,
            branch: null,
            email: row.paypal_email,
            phone: row.mobile,
            createdAt: new Date(0),
            legacyReadOnly: true,
        };
    });
}

export type LegacyDepartmentRow = {
    id: string;
    name: string;
    email: string | null;
    legacyReadOnly: boolean;
};

export async function fetchLegacyDepartmentRows(): Promise<LegacyDepartmentRow[]> {
    const { rows } = await pool.query<{ legacy_pk: string; name: string; email: string | null }>(`
      SELECT _legacy_pk::text AS legacy_pk, trim(name) AS name, nullif(trim(email), '') AS email
      FROM legacy_archive.webxl_department
      WHERE nullif(trim(name), '') IS NOT NULL
      ORDER BY _legacy_pk::int ASC
    `);
    return rows.map((row) => ({
        id: `legacy-department-${row.legacy_pk}`,
        name: row.name,
        email: row.email,
        legacyReadOnly: true,
    }));
}

async function fetchRefIdHierarchyTree(
    table: "webxl_ab_packages" | "webxl_portfolio_categories",
    idPrefix: string,
): Promise<CompanyBusinessCategoryNode[]> {
    const { rows } = await pool.query<{
        legacy_pk: string;
        legacy_id: string;
        name: string;
        parent_ref: string;
    }>(`
      SELECT
        _legacy_pk::text AS legacy_pk,
        trim(id) AS legacy_id,
        trim(name) AS name,
        trim(coalesce(ref_id, '0')) AS parent_ref
      FROM legacy_archive.${table}
      WHERE nullif(trim(name), '') IS NOT NULL
      ORDER BY trim(name) ASC
    `);

    const childrenByParentRef = new Map<string, typeof rows>();
    for (const row of rows) {
        const parentKey = row.parent_ref || "0";
        if (!childrenByParentRef.has(parentKey)) childrenByParentRef.set(parentKey, []);
        childrenByParentRef.get(parentKey)!.push(row);
    }

    const build = (row: (typeof rows)[number]): CompanyBusinessCategoryNode => ({
        id: `${idPrefix}-${row.legacy_pk}`,
        name: row.name,
        uae: null,
        legacyReadOnly: true,
        children: (childrenByParentRef.get(row.legacy_id) ?? []).map(build),
    });

    return rows.filter((r) => (r.parent_ref || "0") === "0").map(build);
}

export async function fetchAlibabaPackagesTree(): Promise<CompanyBusinessCategoryNode[]> {
    return fetchRefIdHierarchyTree("webxl_ab_packages", "legacy-ab-package");
}

export async function fetchPortfolioCategoriesTree(): Promise<CompanyBusinessCategoryNode[]> {
    return fetchRefIdHierarchyTree("webxl_portfolio_categories", "legacy-portfolio-cat");
}

export async function fetchLegacyAttributesForCategory(
    sidebarCategory: string,
): Promise<AttributeListRow[]> {
    if (sidebarCategory === "Q & A") {
        return fetchLegacyQaRows();
    }
    if (sidebarCategory === "Whatsapp Message") {
        return fetchLegacyWhatsappRows();
    }
    if (sidebarCategory === "Penalty Head") {
        return fetchLegacyPenaltyHeadRows();
    }
    if (sidebarCategory === "Buyer Detail") {
        return fetchLegacyBuyerDetailRows();
    }

    const { refIds } = resolveAttributeUiSources(sidebarCategory);
    if (!refIds.length) return [];

    const { rows } = await pool.query<{
        legacy_pk: string;
        name: string;
        time_raw: string | null;
        branch_raw: string | null;
    }>(
        `
      SELECT
        a._legacy_pk::text AS legacy_pk,
        trim(a.name) AS name,
        nullif(trim(a.time), '') AS time_raw,
        nullif(trim(a.branch), '') AS branch_raw
      FROM legacy_archive.webxl_attribute a
      WHERE trim(a."refId") = ANY($1::text[])
        AND nullif(trim(a.name), '') IS NOT NULL
        AND a._legacy_pk::text <> ALL($2::text[])
      ORDER BY a._legacy_pk::int
    `,
        [refIds, LEGACY_MISFILE_IDS],
    );

    return rows.map((row) => ({
        id: `legacy-attribute-${row.legacy_pk}`,
        category: sidebarCategory,
        name: row.name,
        parentId: null,
        amount: null,
        dateLabel:
            sidebarCategory === "Govt Leave" || sidebarCategory === "Account Monthly Task"
                ? row.time_raw
                : null,
        branch: sidebarCategory === "Account Monthly Task" ? row.branch_raw : null,
        email: null,
        phone: null,
        createdAt: new Date(0),
        legacyReadOnly: true,
    }));
}

export type CompanyBusinessCategoryNode = {
    id: string;
    name: string;
    uae: string | null;
    children: CompanyBusinessCategoryNode[];
    legacyReadOnly: boolean;
};

export async function fetchCompanyBusinessCategoryTree(): Promise<CompanyBusinessCategoryNode[]> {
    const { rows } = await pool.query<{
        id: string;
        name: string;
        parent_id: string;
        uae: string | null;
    }>(`
      SELECT
        _legacy_pk::text AS id,
        trim(name) AS name,
        trim(coalesce(root_id, '0')) AS parent_id,
        nullif(trim(uae), '') AS uae
      FROM legacy_archive.webxl_category
      WHERE nullif(trim(name), '') IS NOT NULL
      ORDER BY trim(name) ASC
    `);

    const childrenByParent = new Map<string, typeof rows>();
    for (const row of rows) {
        const parentKey = row.parent_id || "0";
        if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
        childrenByParent.get(parentKey)!.push(row);
    }

    // Legacy drm-attributes tree: top-level nodes have root_id 0 (e.g. Apparel), not only uae=type.
    const roots = rows.filter((r) => {
        const parent = r.parent_id || "0";
        return parent === "0";
    });

    const build = (row: (typeof rows)[number]): CompanyBusinessCategoryNode => ({
        id: row.id,
        name: row.name,
        uae: row.uae,
        legacyReadOnly: true,
        children: (childrenByParent.get(row.id) ?? []).map(build),
    });

    return roots.map(build);
}

export function parseLegacyAttributeId(id: string): string | null {
    if (!id.startsWith("legacy-attribute-")) return null;
    const pk = id.slice("legacy-attribute-".length).trim();
    return pk || null;
}

export function parseLegacyQuestionId(id: string): string | null {
    if (!id.startsWith("legacy-question-")) return null;
    const pk = id.slice("legacy-question-".length).trim();
    return pk || null;
}

/** Delete one legacy Q&A row; questions (qid 0) also remove their answers. */
export async function deleteLegacyQuestionRow(legacyPk: string): Promise<boolean> {
    const { rows } = await pool.query<{ id: string; qid: string }>(
        `
      SELECT trim(id) AS id, trim(coalesce(qid, '0')) AS qid
      FROM legacy_archive.webxl_questions
      WHERE _legacy_pk::text = $1
      LIMIT 1
    `,
        [legacyPk],
    );
    if (!rows.length) return false;
    const row = rows[0];
    if (row.qid === "0") {
        await pool.query(`DELETE FROM legacy_archive.webxl_questions WHERE trim(qid) = $1`, [row.id]);
        const { rowCount } = await pool.query(
            `DELETE FROM legacy_archive.webxl_questions WHERE _legacy_pk::text = $1`,
            [legacyPk],
        );
        return (rowCount ?? 0) > 0;
    }
    const { rowCount } = await pool.query(
        `DELETE FROM legacy_archive.webxl_questions WHERE _legacy_pk::text = $1`,
        [legacyPk],
    );
    return (rowCount ?? 0) > 0;
}

export async function deleteLegacyAttributeRow(legacyPk: string): Promise<boolean> {
    const { rowCount } = await pool.query(
        `DELETE FROM legacy_archive.webxl_attribute WHERE _legacy_pk::text = $1`,
        [legacyPk],
    );
    return (rowCount ?? 0) > 0;
}

function parseLegacyPrefixedId(id: string, prefix: string): string | null {
    if (!id.startsWith(prefix)) return null;
    const pk = id.slice(prefix.length).trim();
    return pk || null;
}

export const parseLegacyWhatsappId = (id: string) => parseLegacyPrefixedId(id, "legacy-whatsapp-");
export const parseLegacyPenaltyId = (id: string) => parseLegacyPrefixedId(id, "legacy-penalty-");
export const parseLegacyBuyerId = (id: string) => parseLegacyPrefixedId(id, "legacy-buyer-");
export const parseLegacyDepartmentId = (id: string) => parseLegacyPrefixedId(id, "legacy-department-");
export const parseLegacyAbPackageId = (id: string) => parseLegacyPrefixedId(id, "legacy-ab-package-");
export const parseLegacyPortfolioCatId = (id: string) => parseLegacyPrefixedId(id, "legacy-portfolio-cat-");

async function deleteLegacyHierarchyRow(
    table: "webxl_ab_packages" | "webxl_portfolio_categories",
    legacyPk: string,
): Promise<boolean> {
    const { rows } = await pool.query<{ legacy_id: string }>(
        `SELECT trim(id) AS legacy_id FROM legacy_archive.${table} WHERE _legacy_pk::text = $1 LIMIT 1`,
        [legacyPk],
    );
    if (!rows.length) return false;
    await pool.query(`DELETE FROM legacy_archive.${table} WHERE trim(ref_id) = $1`, [rows[0].legacy_id]);
    const { rowCount } = await pool.query(
        `DELETE FROM legacy_archive.${table} WHERE _legacy_pk::text = $1`,
        [legacyPk],
    );
    return (rowCount ?? 0) > 0;
}

export async function deleteLegacyWhatsappRow(legacyPk: string): Promise<boolean> {
    const { rowCount } = await pool.query(
        `DELETE FROM legacy_archive.webxl_whatsapp WHERE _legacy_pk::text = $1`,
        [legacyPk],
    );
    return (rowCount ?? 0) > 0;
}

export async function deleteLegacyPenaltyHeadRow(legacyPk: string): Promise<boolean> {
    const { rowCount } = await pool.query(
        `DELETE FROM legacy_archive.webxl_penalty_head WHERE _legacy_pk::text = $1`,
        [legacyPk],
    );
    return (rowCount ?? 0) > 0;
}

export async function deleteLegacyBuyerRow(legacyPk: string): Promise<boolean> {
    const { rows } = await pool.query<{ legacy_id: string; ref_id: string; user_id: string | null }>(
        `SELECT trim(id) AS legacy_id, trim(coalesce(ref_id,'0')) AS ref_id, nullif(trim(user_id), '') AS user_id
         FROM legacy_archive.webxl_dollar_buyer WHERE _legacy_pk::text = $1 LIMIT 1`,
        [legacyPk],
    );
    if (!rows.length) return false;
    if (rows[0].ref_id === "0") {
        await pool.query(
            `DELETE FROM legacy_archive.webxl_dollar_buyer
             WHERE trim(ref_id) = $1 OR ($2::text IS NOT NULL AND trim(ref_id) = $2)`,
            [rows[0].legacy_id, rows[0].user_id],
        );
    }
    const { rowCount } = await pool.query(
        `DELETE FROM legacy_archive.webxl_dollar_buyer WHERE _legacy_pk::text = $1`,
        [legacyPk],
    );
    return (rowCount ?? 0) > 0;
}

export async function deleteLegacyDepartmentRow(legacyPk: string): Promise<boolean> {
    const { rowCount } = await pool.query(
        `DELETE FROM legacy_archive.webxl_department WHERE _legacy_pk::text = $1`,
        [legacyPk],
    );
    return (rowCount ?? 0) > 0;
}

export async function deleteLegacyAbPackageRow(legacyPk: string): Promise<boolean> {
    return deleteLegacyHierarchyRow("webxl_ab_packages", legacyPk);
}

export async function deleteLegacyPortfolioCatRow(legacyPk: string): Promise<boolean> {
    return deleteLegacyHierarchyRow("webxl_portfolio_categories", legacyPk);
}

export function mergeAttributeLists(
    sidebarCategory: string,
    modern: AttributeListRow[],
    legacy: AttributeListRow[],
): AttributeListRow[] {
    const seen = new Set(modern.map((m) => m.name.trim().toLowerCase()));
    const merged: AttributeListRow[] = modern.map((m) => ({ ...m, category: sidebarCategory }));
    for (const row of legacy) {
        const key = row.name.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ ...row, category: sidebarCategory });
    }
    return merged;
}
