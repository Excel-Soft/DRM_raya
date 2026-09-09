import { pool } from '../server/db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    try {
        const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '20260216_add_gm_approval_workflow.sql'), 'utf8');
        console.log('Running migration: 20260216_add_gm_approval_workflow.sql');
        await pool.query(sql);
        console.log('✓ Migration completed successfully');
        console.log('✓ Added approval workflow columns to gm_pool_entries table');
        process.exit(0);
    } catch (error: any) {
        console.error('✗ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

runMigration();
