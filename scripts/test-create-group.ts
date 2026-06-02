
import { pool } from "../server/db";

async function testCreateGroup() {
    console.log("Testing Create Group...");
    try {
        // 1. Create a group directly via SQL to verify DB
        const res = await pool.query(`
      INSERT INTO user_groups (name, description) 
      VALUES ('Test Group', 'Created via test script') 
      RETURNING *;
    `);
        console.log("Group created in DB:", res.rows[0]);

        // 2. Query it back
        const list = await pool.query(`SELECT * FROM user_groups`);
        console.log("Groups in DB:", list.rows.length);

    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        process.exit();
    }
}

testCreateGroup();
