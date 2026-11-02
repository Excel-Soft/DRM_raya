import type { Pool } from "pg";

function normCompany(name: string): string {
  return name.trim().toLowerCase();
}

/** Active GM (Full / Loan / Partial) for this company name. */
export async function companyHasActiveGm(pool: Pool, companyName: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT id FROM drm.gm_entries
     WHERE lower(trim(company_name)) = $1
       AND coalesce(is_deleted, false) = false
       AND lower(coalesce(status::text, '')) NOT IN ('rejected', 'cancelled', 'withdrawn')
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
