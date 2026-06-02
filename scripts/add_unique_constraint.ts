import { pool } from "../server/db";

async function addUniqueConstraint() {
  const client = await pool.connect();
  try {
    console.log("Adding unique constraint to task_results(task_id)...");
    await client.query(`
      ALTER TABLE drm.task_results
      ADD CONSTRAINT task_results_task_id_unique UNIQUE (task_id);
    `);
    console.log("Constraint added successfully.");
  } catch (error) {
    console.error("Error adding constraint:", error);
  } finally {
    client.release();
    pool.end();
  }
}

addUniqueConstraint();
