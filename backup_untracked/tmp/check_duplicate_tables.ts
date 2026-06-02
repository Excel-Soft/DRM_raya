import { pool } from "../server/db";

async function checkDuplicates() {
    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'drm'
      );
    `);

        console.log("Tables in BOTH public and drm schemas:");
        const duplicateTables = res.rows.map(r => r.table_name);
        console.log(duplicateTables);

        for (const table of duplicateTables) {
            const pRes = await pool.query(`SELECT count(*) FROM public.${table}`);
            const dRes = await pool.query(`SELECT count(*) FROM drm.${table}`);
            console.log(`Table: ${table} | public: ${pRes.rows[0].count} rows | drm: ${dRes.rows[0].count} rows`);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkDuplicates();
