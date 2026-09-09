import pg from 'pg';
import 'dotenv/config';

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    await client.query("SET search_path TO drm, public");

    console.log("Fetching roles and permissions...");

    // 1. Get all roles
    const rolesRes = await client.query("SELECT id, name FROM roles");
    const rolesMap = new Map(rolesRes.rows.map(r => [r.id, r.name.toLowerCase()]));

    // 2. Get all module permissions and their assigned roles
    const permsRes = await client.query(`
      SELECT 
        p.module,
        array_agg(DISTINCT r.name) as allowed_roles
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN roles r ON r.id = rp.role_id
      GROUP BY p.module
    `);

    const moduleToRoles = new Map<string, string[]>();
    permsRes.rows.forEach(row => {
      moduleToRoles.set(row.module, row.allowed_roles.map((r: string) => r.toLowerCase()));
    });

    // 3. Define mapping from module to Menu Name and Icon
    const menuMapping: Record<string, { name: string, icon: string }> = {
      'customers': { name: 'Customer', icon: 'TrendingUp' },
      'opportunities': { name: 'Target System', icon: 'Target' },
      'projects': { name: 'PMS', icon: 'ClipboardList' },
      'tasks': { name: 'Running Task', icon: 'ClipboardList' },
      'support': { name: 'Support', icon: 'Headset' },
      'accounts': { name: 'Account', icon: 'DollarSign' },
      'settings': { name: 'DRM Setting', icon: 'Settings' },
      'hr': { name: 'HR Department', icon: 'Users' },
      'training': { name: 'Training', icon: 'Book' },
      'reports': { name: 'Reports', icon: 'FileText' },
      'office': { name: 'Office Account', icon: 'Briefcase' },
      'policies': { name: 'Policies', icon: 'FileText' },
      'attendance': { name: 'Attendance', icon: 'CalendarCheck' },
    };

    console.log("Synchronizing drm.menu_permissions...");

    for (const [module, roles] of Array.from(moduleToRoles.entries())) {
      const config = menuMapping[module] || { name: module.charAt(0).toUpperCase() + module.slice(1), icon: 'Home' };
      
      // Check if already exists
      const existing = await client.query("SELECT id FROM drm.menu_permissions WHERE name = $1", [config.name]);
      
      if (existing.rows.length > 0) {
        // Update
        await client.query(`
          UPDATE drm.menu_permissions 
          SET allowed_role_ids = $1, menu_icon = $2, is_active = true, updated_at = NOW()
          WHERE name = $3
        `, [roles, config.icon, config.name]);
        console.log(`Updated menu: ${config.name}`);
      } else {
        // Insert
        await client.query(`
          INSERT INTO drm.menu_permissions (name, menu_icon, allowed_role_ids, is_active, permissions, sub_urls)
          VALUES ($1, $2, $3, true, '[]'::jsonb, '{"isRoot": true, "items": []}'::jsonb)
        `, [config.name, config.icon, roles]);
        console.log(`Created menu: ${config.name}`);
      }
    }

    // Special case for "Admin Dashboard" if not created
    const adminCheck = await client.query("SELECT id FROM drm.menu_permissions WHERE name = 'Users'");
    if (adminCheck.rows.length > 0) {
        await client.query("UPDATE drm.menu_permissions SET allowed_role_ids = ARRAY['admin'] WHERE name = 'Users'");
    }

    client.release();
    console.log("Synchronization complete.");
  } catch (err) {
    console.error("Error during synchronization:", err);
  } finally {
    await pool.end();
  }
}

main();
