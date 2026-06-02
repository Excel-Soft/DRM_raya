import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function run() {
  const res = await db.execute(sql`SELECT id FROM drm.tasks WHERE CAST(id AS TEXT) LIKE 'd3018%'`);
  console.log(res.rows);
  process.exit(0);
}
run().catch(console.error);
