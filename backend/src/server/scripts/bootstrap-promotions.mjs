import pg from "pg";
import dotenv from "dotenv";
import { seedPromotionsFromLegacyIfEmpty } from "../utils/promotion-legacy.ts";

dotenv.config();

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const n = await seedPromotionsFromLegacyIfEmpty(pool);
    const c = await pool.query("SELECT COUNT(*)::int AS n FROM drm.promotions WHERE deleted_at IS NULL");
    console.log(`promotions: seeded ${n}, total ${c.rows[0].n}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
