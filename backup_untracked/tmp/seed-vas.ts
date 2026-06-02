
import { pool } from "../server/db";

async function seedVas() {
    try {
        console.log("Seeding dummy VAS entry...");
        // Get an admin user id
        const userResult = await pool.query("SELECT id FROM users LIMIT 1");
        if (userResult.rows.length === 0) {
            console.error("No users found to associate with VAS entry");
            return;
        }
        const userId = userResult.rows[0].id;

        await pool.query(`
            INSERT INTO office_vas (company_name, amount, currency, method, vas_date, notes, created_by_user_id)
            VALUES ($1, $2, $3, $4, NOW(), $5, $6)
        `, ["Test Company VAS", 500.00, "PKR", "Cash", "Initial seed entry for testing the report", userId]);

        console.log("Successfully seeded VAS entry.");
    } catch (err) {
        console.error("Error seeding VAS:", err);
    } finally {
        process.exit(0);
    }
}

seedVas();
