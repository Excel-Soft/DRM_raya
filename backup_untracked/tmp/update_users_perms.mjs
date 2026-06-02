import pkg from 'pg';
const { Client } = pkg;

const connectionString = "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres";

async function updateUsersPerms() {
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        // Define common roles that should have access to /users endpoint (needed for Super Admin)
        const roles = [
            "admin", "super_admin", "administrator", "junior_admin", "super_hod", "accountant", "account_manager"
        ];

        // Update the 'users' row in url_permissions
        await client.query(
            "UPDATE drm.url_permissions SET allowed_role_ids = $1 WHERE path = 'users'",
            [roles]
        );

        console.log("Updated users endpoint permissions for super_admin roles.");
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

updateUsersPerms();
