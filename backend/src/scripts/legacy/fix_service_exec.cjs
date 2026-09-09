require('dotenv').config();
const pg = require('pg');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const modules = ['Customer', 'Attendance', 'PMS', 'LEAD', 'Training', 'User Reports', 'Support'];
    
    for (const mod of modules) {
      const res = await pool.query("SELECT allowed_role_ids FROM drm.menu_permissions WHERE name ILIKE $1", [`%${mod}%`]);
      if (res.rows.length > 0) {
        let currentRoles = res.rows[0].allowed_role_ids || [];
        if (!currentRoles.includes('service_executive')) {
          currentRoles.push('service_executive');
          await pool.query("UPDATE drm.menu_permissions SET allowed_role_ids = $1 WHERE name ILIKE $2", [currentRoles, `%${mod}%`]);
          console.log(`Added service_executive to ${mod}`);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
