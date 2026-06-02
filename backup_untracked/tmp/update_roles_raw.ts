import pg from 'pg';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const contents = fs.readFileSync(envPath, 'utf8');
    const parsed = dotenv.parse(contents);
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const pool = new pg.Pool({ 
    connectionString: process.env.DATABASE_URL, 
    ssl: { rejectUnauthorized: false } 
});

async function main() {
    console.log("Updating roles in drm schema...");

    // Roles to delete
    const rolesToRemove = ['support_agent', 'brand_new_role'];
    for (const role of rolesToRemove) {
        console.log(`Deleting role: ${role}`);
        await pool.query('DELETE FROM drm.roles WHERE name = $1', [role]);
    }

    // Role definitions
    const rolesToAdd = [
        { name: 'product_posting_manager', desc: 'Product Posting Manager' },
        { name: 'dd_manager', desc: 'D&D Manager' },
        { name: 'qa_manager', desc: 'QA Manager' },
        { name: 'verification_manager', desc: 'Verification Manager' },
        { name: 'posting_executive', desc: 'Posting Executive' },
        { name: 'dd_executive', desc: 'D&D Executive' }
    ];

    for (const role of rolesToAdd) {
        console.log(`Upserting role: ${role.name}`);
        await pool.query(`
            INSERT INTO drm.roles (name, description, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (name) DO UPDATE 
            SET description = EXCLUDED.description, updated_at = NOW()
        `, [role.name, role.desc]);
    }

    console.log("Roles updated successfully.");
}

main()
    .catch(console.error)
    .finally(() => pool.end());
