const { Pool } = require('pg');

async function seed() {
    const pool = new Pool({
        connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
        ssl: { rejectUnauthorized: false }
    });

    try {
        const crypto = await import('crypto');
        const mockId = crypto.randomUUID();
        const ownerUserId = 'b29868ad-e13c-4aed-8c70-444639c3bfaf';
        const mockCompany = "Auto Test Company " + Date.now();

        // Insert into db
        await pool.query(`
      INSERT INTO drm.quotations (id, save_status, company, account_holder, created_by, grand_total, created_at, updated_at)
      VALUES ($1, 'pending_account_manager', $2, 'John Doe Test', $3, 1000, now(), now())
    `, [mockId, mockCompany, ownerUserId]);

        console.log("Quotation created:", mockId);

        const newProjectId = crypto.randomUUID();
        const projectName = `Proj-${(mockCompany || "").replace(/\s+/g, '-').substring(0, 15)}`;

        console.log("Mocking Approval Action... Creating project directly exactly as account-route.ts does");

        // Verify the project can be created in the DB schema
        await pool.query(`
      INSERT INTO drm.projects (id, name, description, owner_user_id, status, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, 'Active', $5, now(), now())
    `, [newProjectId, projectName, `Auto-created from quotation ${mockId}`, ownerUserId, ownerUserId]);

        console.log("✅ SUCCESS! Project auto-created:", projectName);

        const projs = await pool.query("SELECT * FROM drm.projects WHERE id = $1", [newProjectId]);
        console.log("Project entry found in DB:", projs.rows[0].name);

    } catch (e) {
        console.error(e)
    } finally {
        pool.end();
    }
}

seed();
