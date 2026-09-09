import { pool } from "../db";

/**
 * Ensure a dedicated schema (sales_<userId>) and a copy of the customers table exist.
 * Called lazily when a Sales‑Executive makes a request.
 */
export async function ensureSalesSchema(userId: string) {
  // Replace hyphens (UUID) with underscores for a valid identifier
  const schemaName = `sales_${userId.replace(/-/g, "_")}`;
  const client = await pool.connect();
  try {
    // 1️⃣ Create schema if it does not exist
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

    // 2️⃣ Create a customers table inside that schema, cloning the definition from public.customers
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.customers (
        LIKE public.customers INCLUDING ALL
      );
    `);

    // 3️⃣ (Optional) Re‑create the most important indexes in the new schema
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes WHERE schemaname = '${schemaName}' AND indexname = 'idx_customers_company_name_unique'
        ) THEN
          CREATE UNIQUE INDEX idx_customers_company_name_unique ON ${schemaName}.customers (lower(trim(company_name)));
        END IF;
      END $$;
    `);
  } catch (e) {
    console.warn(`[ensureSalesSchema] error for user ${userId}:`, e);
  } finally {
    client.release();
  }
}
