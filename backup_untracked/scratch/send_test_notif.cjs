const pg = require('pg');

async function test() {
  const pool = new pg.Pool({
    connectionString: "postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres",
    ssl: { rejectUnauthorized: false }
  });
  try {
    const userId = '0dccb495-9eb3-4ad8-923d-5e6a9677beff';
    await pool.query("INSERT INTO drm.notifications (id, user_id, message, type, read_status, created_at) VALUES (gen_random_uuid(), $1, 'Test Notification from System for Account Approval', 'SUCCESS', 'UNREAD', NOW())", [userId]);
    console.log('Test notification sent successfully to user ' + userId);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
