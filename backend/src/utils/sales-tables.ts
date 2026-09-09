import { pool } from "../db";

const initializedUsers = new Set<string>();
const userPromises = new Map<string, Promise<string>>();

let fanoutInitialized = false;
let fanoutPromise: Promise<void> | null = null;

/**
 * Creates a dedicated tracking table for a Sales Executive.
 */
export async function ensureSalesTables(
  userId: string,
  roleId: string
): Promise<string> {
  const normalizedRole = roleId.toLowerCase();
  const isMgr = ["manager", "admin", "superadmin", "hod", "reception"].some(r => normalizedRole.includes(r));
  if (isMgr) return "drm.customers";

  const cleanUserId = userId.replace(/-/g, "_");
  const tableName = `sales_${cleanUserId}`;

  if (initializedUsers.has(userId) && fanoutInitialized) {
    return `drm.${tableName}`;
  }

  // Prevent concurrent execution for the same user
  if (userPromises.has(userId)) {
    return userPromises.get(userId)!;
  }

  const promise = (async () => {
    const client = await pool.connect();
    try {
      // 1. Setup the global fanout trigger once
      if (!fanoutInitialized) {
        if (!fanoutPromise) {
          fanoutPromise = (async () => {
            try {
              await client.query(`
                CREATE OR REPLACE FUNCTION drm.fanout_sales_executives()
                RETURNS TRIGGER AS $$
                DECLARE
                  target_table text;
                  col_list text;
                  missing_col record;
                BEGIN
                  IF TG_OP = 'DELETE' THEN
                    IF OLD.owner_user_id IS NOT NULL THEN
                      target_table := 'sales_' || replace(OLD.owner_user_id::text, '-', '_');
                      IF EXISTS (
                        SELECT FROM information_schema.tables
                        WHERE table_schema = 'drm' AND table_name = target_table
                      ) THEN
                        EXECUTE format('DELETE FROM drm.%I WHERE id = $1', target_table) USING OLD.id;
                      END IF;
                    END IF;
                    RETURN OLD;
                  END IF;

                  IF NEW.owner_user_id IS NOT NULL THEN
                    target_table := 'sales_' || replace(NEW.owner_user_id::text, '-', '_');

                    IF EXISTS (
                      SELECT FROM information_schema.tables
                      WHERE table_schema = 'drm' AND table_name = target_table
                    ) THEN
                      -- Self-heal: a column added to drm.customers after this
                      -- shadow table was created never reaches it on its own,
                      -- which made the row-by-row 'SELECT ($1).*' fanout below
                      -- fail with "INSERT has more expressions than target
                      -- columns" the next time ANY customer row changed.
                      -- Sync missing columns here, every fire, so this never
                      -- recurs regardless of how many shadow tables exist.
                      FOR missing_col IN
                        SELECT c.column_name, c.data_type, c.udt_name
                          FROM information_schema.columns c
                         WHERE c.table_schema = 'drm' AND c.table_name = 'customers'
                           AND c.column_name NOT IN (
                             SELECT column_name FROM information_schema.columns
                              WHERE table_schema = 'drm' AND table_name = target_table
                           )
                      LOOP
                        EXECUTE format(
                          'ALTER TABLE drm.%I ADD COLUMN IF NOT EXISTS %I %s',
                          target_table, missing_col.column_name,
                          CASE
                            WHEN missing_col.data_type = 'ARRAY' THEN substring(missing_col.udt_name from 2) || '[]'
                            WHEN missing_col.data_type = 'USER-DEFINED' THEN missing_col.udt_name
                            ELSE missing_col.data_type
                          END
                        );
                      END LOOP;

                      -- Name-matched column list (not positional SELECT *) so a
                      -- newly-synced column landing at the end of the shadow
                      -- table's physical order still maps to the right field.
                      SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
                        INTO col_list
                        FROM information_schema.columns
                       WHERE table_schema = 'drm' AND table_name = 'customers';

                      IF TG_OP = 'INSERT' THEN
                        EXECUTE format(
                          'INSERT INTO drm.%I (%s) SELECT %s FROM (SELECT ($1).*) AS src',
                          target_table, col_list, col_list
                        ) USING NEW;
                      ELSIF TG_OP = 'UPDATE' THEN
                        EXECUTE format('DELETE FROM drm.%I WHERE id = $1', target_table) USING NEW.id;
                        EXECUTE format(
                          'INSERT INTO drm.%I (%s) SELECT %s FROM (SELECT ($1).*) AS src',
                          target_table, col_list, col_list
                        ) USING NEW;
                      END IF;
                    END IF;
                  END IF;
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql SET search_path = drm, public;

                DROP TRIGGER IF EXISTS trg_fanout_customers_to_sales ON drm.customers;
                CREATE TRIGGER trg_fanout_customers_to_sales
                AFTER INSERT OR UPDATE OR DELETE ON drm.customers
                FOR EACH ROW EXECUTE FUNCTION drm.fanout_sales_executives();
              `);
              fanoutInitialized = true;
            } catch (err: any) {
              if (err.code === 'XX000' || err.message.includes('concurrent')) {
                console.warn("[SALES_TABLES] Ignored concurrent update error during trigger creation");
                fanoutInitialized = true;
              } else {
                fanoutPromise = null; // allow retry
                throw err;
              }
            }
          })();
        }
        await fanoutPromise;
      }

      // 2. Create per-executive table if it does not exist
      if (!initializedUsers.has(userId)) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS drm.${tableName} (
            LIKE drm.customers INCLUDING ALL
          );
        `);

        // `CREATE TABLE IF NOT EXISTS ... LIKE` is a no-op once the table
        // already exists, so a column added to drm.customers later never
        // reaches these per-executive shadow tables on its own — the
        // resulting column-count mismatch makes `INSERT ... SELECT *` fail
        // with "INSERT has more expressions than target columns". Sync any
        // missing columns first so this self-heals instead of recurring.
        const missingCols = await client.query(
          `SELECT c.column_name, c.data_type, c.udt_name
             FROM information_schema.columns c
            WHERE c.table_schema = 'drm' AND c.table_name = 'customers'
              AND c.column_name NOT IN (
                SELECT column_name FROM information_schema.columns
                 WHERE table_schema = 'drm' AND table_name = $1
              )`,
          [tableName],
        );
        for (const col of missingCols.rows) {
          const type = col.data_type === "USER-DEFINED" ? col.udt_name : col.data_type;
          await client.query(
            `ALTER TABLE drm.${tableName} ADD COLUMN IF NOT EXISTS "${col.column_name}" ${type}`,
          );
        }

        // A newly-ALTERed column lands at the end of this shadow table, not in
        // drm.customers' original position, so a positional `SELECT *` would
        // silently insert values into the wrong columns. List columns by name
        // (customers' own order) on both sides so the mapping is by name, not
        // position, regardless of how each table's columns are physically ordered.
        const customerCols = await client.query(
          `SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'drm' AND table_name = 'customers'
            ORDER BY ordinal_position`,
        );
        const colList = customerCols.rows.map((r) => `"${r.column_name}"`).join(", ");

        await client.query(`
          INSERT INTO drm.${tableName} (${colList})
          SELECT ${colList} FROM drm.customers
          WHERE coalesce(owner_user_id::text, created_by::text) = $1
          ON CONFLICT (id) DO NOTHING;
        `, [userId]);
        initializedUsers.add(userId);
      }

    } finally {
      client.release();
    }
    return `drm.${tableName}`;
  })();

  userPromises.set(userId, promise);
  
  try {
    const result = await promise;
    return result;
  } finally {
    // Keep it in initializedUsers, remove from promises
    userPromises.delete(userId);
  }
}
