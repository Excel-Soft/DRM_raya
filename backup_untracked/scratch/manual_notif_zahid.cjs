const pg = require('pg');

async function send() {
  const pool = new pg.Pool({
    connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  try {
    const userId = '0dccb495-9eb3-4ad8-923d-5e6a9677beff';
    const msg = "Product Posting Invoice approved! Project zahid • talha auto-created. Please upload required documents.";
    
    await pool.query(`
        INSERT INTO drm.notifications (id, user_id, message, type, read_status, target_url, created_at)
        VALUES (gen_random_uuid(), $1, $2, 'SUCCESS', 'UNREAD', '/pms/approvals', NOW())
    `, [userId, msg]);
    
    console.log('Manually sent notification for Zahid');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

send();
