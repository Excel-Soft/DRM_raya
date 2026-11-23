import type { Pool } from "pg";

function normCompany(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Does this company already have a GM anywhere? (Temp GM may only be added when not.)
 * The company is resolved by name to its customer record(s); a GM counts when found in
 *   - drm.gm_entries (Full / Loan / Partial, new + old-DRM), not deleted / rejected /
 *     cancelled / withdrawn - matched by company name, customer id or the company's DRM ID
 *   - drm.legacy_gm_accounts (old DRM GM accounts, webxl_gmaccount)
 *   - drm.gm_pool_entries
 * Previously only gm_entries by exact company name was checked, so a GM saved under a
 * slightly different name / linked by customer only, or an old-DRM GM account, slipped through.
 */
export async function companyHasActiveGm(pool: Pool, companyName: string): Promise<boolean> {
  const { rows } = await pool.query(
    `WITH c AS (
       SELECT id, lower(btrim(drm_id)) AS drm_id
         FROM drm.customers
        WHERE lower(btrim(company_name)) = $1
     )
     SELECT 1 AS hit
      WHERE EXISTS (
              SELECT 1 FROM drm.gm_entries g
               WHERE coalesce(g.is_deleted, false) = false
                 AND lower(coalesce(g.status::text, '')) NOT IN ('rejected', 'cancelled', 'withdrawn')
                 AND (lower(btrim(g.company_name)) = $1
                      OR g.customer_id IN (SELECT id FROM c)
                      OR (g.drm_id IS NOT NULL AND lower(btrim(g.drm_id)) IN (SELECT drm_id FROM c WHERE drm_id <> '')))
            )
         OR EXISTS (SELECT 1 FROM drm.legacy_gm_accounts a WHERE a.customer_id IN (SELECT id FROM c))
         OR EXISTS (SELECT 1 FROM drm.gm_pool_entries p WHERE p.customer_id IN (SELECT id FROM c))
      LIMIT 1`,
    [normCompany(companyName)],
  );
  return rows.length > 0;
}

/** Any non-deleted Temp GM for this company (blocks pool GM until account soft-deletes it). */
export async function companyHasBlockingTempGm(pool: Pool, companyName: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT id FROM drm.temp_gm_entries
     WHERE lower(trim(company_name)) = $1
       AND coalesce(is_deleted, false) = false
     LIMIT 1`,
    [normCompany(companyName)],
  );
  return rows.length > 0;
}
