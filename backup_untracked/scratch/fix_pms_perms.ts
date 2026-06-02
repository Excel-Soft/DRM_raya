
import { pool } from "../server/db";

async function fixPermissions() {
    try {
        console.log("Updating PMS permissions...");
        
        // Add all necessary roles to PMS
        const roles = [
            "admin", "super_admin", "hod", "super_hod", "sales_executive", 
            "sales_manager", "account_manager", "service_manager", 
            "service_executive", "software_manager", "software_executive", 
            "lead_manager", "dd_manager", "dd_executive", 
            "product_posting_manager", "product_posting_executive"
        ];
        
        const res = await pool.query(
            "UPDATE drm.url_permissions SET allowed_role_ids = $1 WHERE path = 'pms*' OR path = 'pms'",
            [roles]
        );
        
        console.log(`Updated ${res.rowCount} rows.`);
        
        // Also check if team-workspace specifically exists
        const checkSpecific = await pool.query("SELECT id FROM drm.url_permissions WHERE path = 'pms/team-workspace'");
        if (checkSpecific.rowCount === 0) {
            console.log("Creating specific entry for team-workspace...");
            await pool.query(
                "INSERT INTO drm.url_permissions (path, allowed_role_ids) VALUES ($1, $2)",
                ["pms/team-workspace", roles]
            );
        } else {
             await pool.query(
                "UPDATE drm.url_permissions SET allowed_role_ids = $1 WHERE path = 'pms/team-workspace'",
                [roles]
            );
        }

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

fixPermissions();
