import { pool } from "../db";

async function main() {
  try {
    await pool.query('ALTER TABLE targets ADD COLUMN IF NOT EXISTS year INT NOT NULL DEFAULT 2024;');
    console.log('Fixed targets table');
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
main();
