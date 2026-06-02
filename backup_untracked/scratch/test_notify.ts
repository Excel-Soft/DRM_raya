
import { NotificationService } from "../server/services/notification-service";
import { pool } from "../server/db";

async function testNotify() {
    try {
        // Get a real user ID from the database
        const { rows } = await pool.query('SELECT id FROM drm.users LIMIT 1');
        const userId = rows[0].id;
        console.log("Testing notification for user:", userId);
        
        await NotificationService.notify({
            userId,
            message: "Test Notification " + new Date().toISOString(),
            type: "SUCCESS"
        });
        
        console.log("Notification call completed.");
        
        // Verifying
        const check = await pool.query('SELECT * FROM drm.notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [userId]);
        console.log("Found in DB:", JSON.stringify(check.rows, null, 2));
        
    } catch (err) {
        console.error("TEST FAILED:", err);
    } finally {
        process.exit();
    }
}

testNotify();
