import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function run() {
    const res = await db.execute(sql`SELECT category, COUNT(*) as count FROM product_posting_data GROUP BY category`);
    console.log(res.rows);
    process.exit(0);
}

run();
