import { pool } from "../server/db";

async function cleanupAndCheck() {
    try {
        console.log("Checking data...");

        // 1. List some customers to see what's there
        const customersRes = await pool.query("SELECT id, company_name, created_at FROM customers ORDER BY created_at DESC LIMIT 20");
        console.log("Recent Customers:");
        console.table(customersRes.rows);

        // 2. Identify and delete seeded data - DELETE CHILD TABLES FIRST
        const deleteActivitiesRes = await pool.query("DELETE FROM activities WHERE notes LIKE 'Follow up call %'");
        console.log(`Deleted ${deleteActivitiesRes.rowCount} test activities.`);

        const deleteOppsRes = await pool.query("DELETE FROM opportunities WHERE title LIKE 'Opportunity %'");
        console.log(`Deleted ${deleteOppsRes.rowCount} test opportunities.`);

        const deleteApptsRes = await pool.query("DELETE FROM appointments WHERE notes LIKE 'Strategy meeting %'");
        console.log(`Deleted ${deleteApptsRes.rowCount} test appointments.`);

        const deleteGMsRes = await pool.query("DELETE FROM gm_entries WHERE company_name LIKE 'Test Company %'");
        console.log(`Deleted ${deleteGMsRes.rowCount} test GM entries.`);

        const deleteRes = await pool.query("DELETE FROM customers WHERE company_name LIKE 'Test Company %'");
        console.log(`Deleted ${deleteRes.rowCount} test customers.`);

        const deleteProjectsRes = await pool.query("DELETE FROM projects WHERE name LIKE 'Project %'");
        console.log(`Deleted ${deleteProjectsRes.rowCount} test projects.`);

        const deleteTasksRes = await pool.query("DELETE FROM tasks WHERE title LIKE 'Task %'");
        console.log(`Deleted ${deleteTasksRes.rowCount} test tasks.`);

        console.log("Cleanup completed. Now checking remaining data...");

        const remainingCustomers = await pool.query("SELECT id, company_name FROM customers LIMIT 10");
        console.log("Remaining Customers:");
        console.table(remainingCustomers.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

cleanupAndCheck();
