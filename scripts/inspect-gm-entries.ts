import { pool } from "../server/db";

async function inspect() {
    try {
        const client = await pool.connect();
        try {
            console.log("--- gm_entries columns ---");
            const res = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'gm_entries'
            `);
            res.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

            console.log("\n--- temp_gm_entries columns ---");
            const resTemp = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'temp_gm_entries'
            `);
            resTemp.rows.forEach(r => console.log(`${r.column_name} (${r.data_type})`));

        } finally {
            client.release();
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

inspect();
