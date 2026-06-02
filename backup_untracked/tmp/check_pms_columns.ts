import { pool } from "../server/db";

async function checkColumns() {
    const tables = ['tasks', 'projects', 'task_time_logs'];
    for (const table of tables) {
        try {
            const res = await pool.query(`
        SELECT table_schema, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY table_schema, ordinal_position
      `, [table]);
            console.log(`Table: ${table}`);
            res.rows.forEach((row: any) => {
                console.log(`  [${row.table_schema}] ${row.column_name}: ${row.data_type}`);
            });
        } catch (err: any) {
            console.error(`Error checking ${table}: ${err.message}`);
        }
    }
    process.exit(0);
}

checkColumns();
