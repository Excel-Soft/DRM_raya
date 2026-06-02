const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/webexcelsdrm' });

async function test() {
  const client = await pool.connect();
  try {
    const from = "2023-01-01";
    const to = "2023-12-31";
    const dateFilter = " AND created_at::date >= $1::date AND created_at::date <= $2::date";
    const params = [from, to];

    console.log('Testing statsQuery with dates...');
    await client.query(`
      SELECT 
        COUNT(*) as "total",
        COUNT(CASE WHEN LOWER(status) IN ('completed', 'success', 'approved') THEN 1 END) as "completed",
        COUNT(CASE WHEN LOWER(status) IN ('in progress', 'active') THEN 1 END) as "in_progress",
        COUNT(CASE WHEN LOWER(status) IN ('pending', 'waiting', 'ready_for_qa') THEN 1 END) as "pending",
        COUNT(CASE WHEN end_date < NOW() AND LOWER(status) NOT IN ('completed', 'success', 'approved') THEN 1 END) as "delayed"
      FROM drm.projects
      WHERE 1=1 ${dateFilter}
    `, params);
    console.log('statsQuery OK');

    console.log('Testing upcomingQuery with dates...');
    await client.query(`
      SELECT COUNT(*) as count 
      FROM drm.projects 
      WHERE end_date >= NOW() AND end_date <= NOW() + INTERVAL '7 days'
      ${dateFilter}
    `, params);
    console.log('upcomingQuery OK');

    console.log('Testing gmPendingQuery with dates...');
    await client.query(`
      SELECT COUNT(*) as count FROM drm.gm_entries WHERE status = 'Pending'
      ${dateFilter}
    `, params);
    console.log('gmPendingQuery OK');

    console.log('Testing leaveCount with dates...');
    await client.query(`
      SELECT COUNT(*) as count
      FROM drm.leave_requests
      WHERE status = 'Pending'
      ${dateFilter}
    `, params);
    console.log('leaveCount OK');

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    client.release();
    pool.end();
  }
}
test();
