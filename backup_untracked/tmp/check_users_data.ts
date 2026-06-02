import { pool } from "../server/db";

async function checkUsersAndData() {
    try {
        const users = await pool.query("SELECT id, full_name, name, username, email FROM users");
        console.log("Users in DB:");
        console.table(users.rows);

        const customersByOwner = await pool.query("SELECT owner_user_id, count(*) FROM customers GROUP BY owner_user_id");
        console.log("Customers by owner_user_id:");
        console.table(customersByOwner.rows);

        const activitiesByCreator = await pool.query("SELECT created_by, count(*) FROM activities GROUP BY created_by");
        console.log("Activities by created_by:");
        console.table(activitiesByCreator.rows);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsersAndData();
