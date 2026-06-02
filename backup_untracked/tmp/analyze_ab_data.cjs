const pg = require("pg");
const { Pool } = pg;
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/webexcels_drm",
});

async function analyze() {
  try {
    console.log("--- GM Entries ---");
    const gmRes = await pool.query("SELECT entry_type, COUNT(*), SUM(amount_usd) as usd, SUM(amount_pkr) as pkr FROM drm.gm_entries GROUP BY entry_type");
    console.table(gmRes.rows);

    console.log("--- Temp GM Entries ---");
    const tempRes = await pool.query("SELECT status, COUNT(*), SUM(amount) as amount FROM drm.temp_gm_entries GROUP BY status");
    console.table(tempRes.rows);

    console.log("--- Refund GM Entries ---");
    const refundRes = await pool.query("SELECT status, COUNT(*), SUM(amount) as amount FROM drm.refund_gm_entries GROUP BY status");
    console.table(refundRes.rows);

    console.log("--- Ledger Entries (Categories) ---");
    const ledgerRes = await pool.query("SELECT category, entry_type, COUNT(*), SUM(amount) as amount FROM drm.ledger_entries GROUP BY category, entry_type");
    console.table(ledgerRes.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

analyze();
