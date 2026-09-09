const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        await pool.query(`
            INSERT INTO drm.menu_permissions (name, menu_icon, is_active, permissions, sub_urls, allowed_role_ids)
            VALUES 
            ('Events', 'CalendarCheck', true, '[{"name": "Admin", "type": "default"}]'::jsonb, '{"items": ["events -> duty-planner"], "isRoot": true}'::jsonb, ARRAY['admin', 'marketing_manager']),
            ('Social Media Posting', 'Megaphone', true, '[{"name": "Admin", "type": "default"}]'::jsonb, '{"items": [], "isRoot": true}'::jsonb, ARRAY['admin', 'marketing_manager'])
        `);
        console.log("Permissions added.");
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
main();
