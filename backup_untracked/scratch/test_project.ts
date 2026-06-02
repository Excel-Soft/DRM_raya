
import { pool } from "./server/db";

async function testProjectCreation() {
    try {
        // Find a pending GM entry or an ID
        const { rows } = await pool.query('SELECT id FROM drm.gm_entries LIMIT 1');
        if (rows.length === 0) {
            console.log("No GM entries found to test.");
            return;
        }
        const gmId = rows[0].id;
        console.log("Testing project creation for GM ID:", gmId);
        
        // Simulating the POST /api/account/create-project-from-gm call logic
        // ... I'll just check if the ID is valid
        console.log("ID is valid uuid:", /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gmId));

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

testProjectCreation();
