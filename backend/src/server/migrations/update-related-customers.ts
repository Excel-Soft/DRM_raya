import { pool } from '../db';

async function updateRelatedCustomersTable() {
    const sql = `
    -- Add new columns to related_customers table
    ALTER TABLE related_customers 
      ADD COLUMN IF NOT EXISTS person_name TEXT,
      ADD COLUMN IF NOT EXISTS follow_status TEXT,
      ADD COLUMN IF NOT EXISTS invoice_number TEXT,
      ADD COLUMN IF NOT EXISTS receipt_number TEXT,
      ADD COLUMN IF NOT EXISTS package_type TEXT,
      ADD COLUMN IF NOT EXISTS gm_amount DECIMAL(12,2),
      ADD COLUMN IF NOT EXISTS pay_date DATE,
      ADD COLUMN IF NOT EXISTS bv_date DATE;
  `;

    try {
        console.log('[Migration] Adding columns to related_customers table...');
        await pool.query(sql);
        console.log('[Migration] ✓ Columns added successfully!');
        return true;
    } catch (error: any) {
        console.error('[Migration] ✗ Failed:', error.message);
        return false;
    }
}

// Run immediately if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    updateRelatedCustomersTable().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

export { updateRelatedCustomersTable };
