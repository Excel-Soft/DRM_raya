const pg = require("pg");
const { Pool } = pg;
require("dotenv").config();

async function checkData() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL
    });

    try {
        const customers = await pool.query("SELECT count(*) FROM drm.customers");
        console.log("Customers Count:", customers.rows[0].count);
        
        const leads = await pool.query("SELECT count(*) FROM drm.lead_activities");
        console.log("Leads Count:", leads.rows[0].count);

        const tasks = await pool.query("SELECT count(*) FROM drm.tasks");
        console.log("Tasks Count:", tasks.rows[0].count);
    } catch (err) {
        console.error("Error checking data:", err);
    } finally {
        await pool.end();
    }
}

checkData();
