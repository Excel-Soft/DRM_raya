import { pool } from "../server/db";

async function moveSchema() {
    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

        const tables = res.rows.map(r => r.table_name);
        console.log(`Found ${tables.length} tables in public schema.`);

        for (const table of tables) {
            if (table !== "drizzle" && table !== "__drizzle_migrations") { // don't move migration tracking
                console.log(`Moving ${table} to drm schema...`);
                // if table already exists in drm, drop it first to avoid collision or skip
                const existsRes = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'drm' AND table_name = $1`, [table]);
                if (existsRes.rowCount > 0) {
                    console.log(`Table ${table} already exists in drm. Dropping the empty one in drm...`);
                    await pool.query(`DROP TABLE drm.${table} CASCADE`);
                }
                await pool.query(`ALTER TABLE public.${table} SET SCHEMA drm`);
            }
        }

        console.log("All tables moved to drm schema successfully.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

moveSchema();
