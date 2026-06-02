import { pool } from "../server/db";

async function moveSchemaSafely() {
    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

        const tables = res.rows.map(r => r.table_name);
        console.log(`Found ${tables.length} tables in public schema.`);

        for (const table of tables) {
            if (table !== "drizzle" && table !== "__drizzle_migrations") {
                console.log(`Processing ${table}...`);

                const existsRes = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'drm' AND table_name = $1`, [table]);

                if (existsRes.rowCount > 0) {
                    const pubCount = await pool.query(`SELECT count(*) FROM public.${table}`).then(r => parseInt(r.rows[0].count, 10));
                    const drmCount = await pool.query(`SELECT count(*) FROM drm.${table}`).then(r => parseInt(r.rows[0].count, 10));

                    if (drmCount > 0 && pubCount === 0) {
                        console.log(`  Table ${table} has data in drm (${drmCount}) but not public. Keeping drm version.`);
                        await pool.query(`DROP TABLE public.${table} CASCADE`);
                        continue;
                    } else if (pubCount > 0 && drmCount === 0) {
                        console.log(`  Table ${table} has data in public (${pubCount}) but not drm. Replacing drm with public.`);
                        await pool.query(`DROP TABLE drm.${table} CASCADE`);
                    } else {
                        console.log(`  Table ${table} has dup data: public: ${pubCount}, drm: ${drmCount}. Assuming public is source of truth...`);
                        await pool.query(`DROP TABLE drm.${table} CASCADE`);
                    }
                }
                await pool.query(`ALTER TABLE public.${table} SET SCHEMA drm`);
            }
        }

        // Now check if enums are in public, move them to drm
        const enumsRes = await pool.query(`
      select t.typname as enum_name
      from pg_type t 
      join pg_enum e on t.oid = e.enumtypid  
      join pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      where n.nspname = 'public'
      group by t.typname;
    `);
        const enums = enumsRes.rows.map(r => r.enum_name);
        for (const ename of enums) {
            console.log(`Moving enum ${ename} to drm...`);
            try {
                await pool.query(`ALTER TYPE public.${ename} SET SCHEMA drm`);
            } catch (e) {
                console.error(`Failed to move enum ${ename}: ${e}`);
            }
        }

        console.log("All tables moved to drm schema successfully.");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

moveSchemaSafely();
