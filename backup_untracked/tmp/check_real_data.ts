import { pool } from "../server/db";

async function checkRealData() {
    try {
        const customers = await pool.query("SELECT * FROM customers");
        console.log("Real Customers:");
        console.table(customers.rows);

        const activities = await pool.query("SELECT * FROM activities");
        console.log("Real Activities:");
        console.table(activities.rows);

        const opps = await pool.query("SELECT * FROM opportunities");
        console.log("Real Opportunities:");
        console.table(opps.rows);

        const gms = await pool.query("SELECT * FROM gm_entries");
        console.log("Real GM Entries:");
        console.table(gms.rows);

        const appts = await pool.query("SELECT * FROM appointments");
        console.log("Real Appointments:");
        console.table(appts.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRealData();
