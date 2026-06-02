import { pool } from "../server/db";

async function run() {
    try {
        const tables = await pool.query("select table_name from information_schema.tables where table_schema = 'public'");
        console.log("Tables in public schema:", tables.rows.map(r => r.table_name));

        const res = await pool.query("select id from users where email = 'talhaexcelstech@gmail.com'");
        const userId = res.rows[0]?.id;

        if (userId) {
            const tableTargets = ['donations', 'invoices', 'gm_entries', 'projects', 'tasks', 'customers', 'bv_entries'];
            for (const table of tableTargets) {
                try {
                    const columns = await pool.query(`select column_name from information_schema.columns where table_name = $1`, [table]);
                    const columnNames = columns.rows.map(r => r.column_name);
                    console.log(`Table: ${table}, Columns: ${columnNames.join(', ')}`);

                    let updated = 0;
                    if (columnNames.includes('owner_user_id')) {
                        const upd = await pool.query(`update ${table} set owner_user_id = $1`, [userId]);
                        updated += upd.rowCount || 0;
                    }
                    if (columnNames.includes('created_by_user_id')) {
                        const upd = await pool.query(`update ${table} set created_by_user_id = $1`, [userId]);
                        updated += upd.rowCount || 0;
                    }
                    if (columnNames.includes('created_by') && !columnNames.includes('created_by_user_id')) {
                        // Some tables use created_by (UUID)
                        const upd = await pool.query(`update ${table} set created_by = $1`, [userId]);
                        updated += upd.rowCount || 0;
                    }
                    if (columnNames.includes('assigned_to_user_id')) {
                        const upd = await pool.query(`update ${table} set assigned_to_user_id = $1`, [userId]);
                        updated += upd.rowCount || 0;
                    }

                    console.log(`Fixed ${updated} rows in ${table}`);

                } catch (e: any) {
                    console.error(`Error processing table ${table}:`, e.message);
                }
            }
        }

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();
