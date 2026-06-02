const { Pool } = require('pg');

async function seed() {
    const pool = new Pool({
        connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
        ssl: { rejectUnauthorized: false }
    });

    try {
        const crypto = await import('crypto');
        const mockId = crypto.randomUUID();
        const ownerUserId = 'b29868ad-e13c-4aed-8c70-444639c3bfaf'; // bilal's ID
        const mockCompany = "Auto Test Company " + Date.now();

        await pool.query(`
      INSERT INTO drm.quotations (id, save_status, company, created_by, grand_total, created_at, updated_at)
      VALUES ($1, 'pending_account_manager', $2, $3, 1000, now(), now())
    `, [mockId, mockCompany, ownerUserId]);
        console.log("Created pending quotation:", mockId);

    } finally {
        pool.end();
    }
}

seed().catch(console.error);
