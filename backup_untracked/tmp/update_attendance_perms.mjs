import pkg from 'pg';
const { Client } = pkg;

const connectionString = "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

async function updatePermissions() {
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        // Define common roles that should have access to Attendance/Todo
        const roles = [
            "admin", "super_admin", "junior_admin", "super_hod", "hod",
            "sales_executive", "sales_manager", "sales_assistant_manager", "account_manager", "manager",
            "developer", "support_agent", "qa_manager", "verification_manager",
            "dd_manager", "dd_executive", "product_posting_manager", "product_posting_executive", 
            "posting_executive", "it_manager", "reception_manager"
        ];

        // Update the 'attendance' row in url_permissions
        // We set allowed_role_ids to these string IDs.
        await client.query(
            "UPDATE drm.url_permissions SET allowed_role_ids = $1 WHERE path = 'attendance' OR path = 'attendance/*'",
            [roles]
        );

        console.log("Updated attendance permissions for all manager roles.");
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

updatePermissions();
