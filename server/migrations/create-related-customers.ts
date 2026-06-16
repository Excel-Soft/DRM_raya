import { pool } from '../db';

async function createRelatedCustomersTable() {
    const sql = `
    -- Create related_customers table for managing customer relationships
    CREATE TABLE IF NOT EXISTS related_customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_name TEXT NOT NULL,
        related_customer TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create index for faster queries
    CREATE INDEX IF NOT EXISTS idx_related_customers_customer_name ON related_customers(customer_name);
    CREATE INDEX IF NOT EXISTS idx_related_customers_created_at ON related_customers(created_at DESC);
  `;

    try {
        console.log('[Migration] Creating related_customers table...');
        await pool.query(sql);
        console.log('[Migration] ✓ related_customers table created successfully');
        return true;
    } catch (error: any) {
        console.error('[Migration] ✗ Failed to create table:', error.message);
        return false;
    }
}

// Run immediately if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    createRelatedCustomersTable().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

export { createRelatedCustomersTable };
