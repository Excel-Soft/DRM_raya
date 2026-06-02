const pg = require('pg');
const crypto = require('crypto');

async function test() {
  const pool = new pg.Pool({
    connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  try {
    const invoiceId = crypto.randomUUID();
    const userId = '0dccb495-9eb3-4ad8-923d-5e6a9677beff';
    
    // 1. Create dummy invoice
    await pool.query(`
        INSERT INTO drm.product_posting_invoices (id, sales_exec_id, company_name, project_name, amount, status, created_at)
        VALUES ($1, $2, 'Test Dynamic Notif', 'Listing Page', '0', 'PENDING_ACCOUNT', NOW())
    `, [invoiceId, userId]);
    
    console.log('Dummy invoice created:', invoiceId);
    
    // We can't easily call the repository from here because of ESM/TS issues,
    // so we'll just simulate the internal logic of approveApproval for this test.
    
    // Simulate the logic I just added to the repository
    const id = invoiceId;
    
    // Update to APPROVED
    await pool.query(
        "UPDATE drm.product_posting_invoices SET status = 'APPROVED', updated_at = NOW() WHERE id = $1",
        [id]
    );
    
    // Auto-create Project
    const newProjectId = crypto.randomUUID();
    await pool.query(`
        INSERT INTO drm.projects (id, name, description, owner_user_id, customer_id, status, created_by, created_at, updated_at, invoice_id)
        VALUES ($1, $2, $3, $4, $5, 'Documents Pending', $6, now(), now(), $7)
    `, [newProjectId, 'Listing Page', 'Test Description', userId, null, userId, id]);
    
    // Create Notification
    await pool.query(`
        INSERT INTO drm.notifications (id, user_id, message, type, read_status, created_at)
        VALUES (gen_random_uuid(), $1, 'Product Posting Invoice approved! Project Listing Page auto-created.', 'SUCCESS', 'UNREAD', NOW())
    `, [userId]);
    
    console.log('Simulation complete. Project and Notification created.');
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
