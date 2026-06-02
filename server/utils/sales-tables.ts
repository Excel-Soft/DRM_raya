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
                BEGIN
                  IF NEW.owner_user_id IS NOT NULL THEN
                    target_table := 'sales_' || replace(NEW.owner_user_id::text, '-', '_');
                    
                    IF EXISTS (
                      SELECT FROM information_schema.tables 
                      WHERE table_schema = 'drm' AND table_name = target_table
                    ) THEN
                      IF TG_OP = 'INSERT' THEN
                        EXECUTE format('INSERT INTO drm.%I SELECT ($1).*', target_table) USING NEW;
                      ELSIF TG_OP = 'UPDATE' THEN
                        EXECUTE format('DELETE FROM drm.%I WHERE id = $1', target_table) USING NEW.id;
                        EXECUTE format('INSERT INTO drm.%I SELECT ($1).*', target_table) USING NEW;
                      ELSIF TG_OP = 'DELETE' THEN
                        EXECUTE format('DELETE FROM drm.%I WHERE id = $1', target_table) USING OLD.id;
                        RETURN OLD;
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
          
        await client.query(`
          INSERT INTO drm.${tableName} 
          SELECT * FROM drm.customers 
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
