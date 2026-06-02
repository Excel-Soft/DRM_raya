
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addRoles() {
  try {
    const rolesToAdd = [
      { name: 'software_manager', description: 'Software Development Manager' },
      { name: 'software_executive', description: 'Software Development Executive' }
    ];

    for (const role of rolesToAdd) {
      const check = await pool.query("SELECT id FROM drm.roles WHERE name = $1", [role.name]);
      if (check.rows.length === 0) {
        await pool.query(
          "INSERT INTO drm.roles (id, name, description, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())",
          [role.name, role.description]
        );
        console.log(`Added role: ${role.name}`);
      } else {
        console.log(`Role already exists: ${role.name}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

addRoles();
