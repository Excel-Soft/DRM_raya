const { db } = require('./server/db');
const { sql } = require('drizzle-orm');

async function checkUser() {
  try {
    const res = await db.execute(sql`SELECT * FROM drm.users WHERE id = '00e97543-f362-46d4-a6a8-e397998d99db'`);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUser();
