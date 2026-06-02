import { pool } from "./server/db";
async function main() {
  const res = await pool.query("SELECT * FROM users WHERE full_name = 'Employee User'");
  console.log("Users named Employee User:", res.rows);
  
  const res2 = await pool.query("SELECT * FROM overtime_records order by created_at desc limit 5");
  console.log("Recent overtime records:", res2.rows);

  const res3 = await pool.query(`select o.id, o.user_id, o.date, o.hours, o.status, o.reason, o.approved_by,
              o.created_at, o.updated_at, u.full_name
         from overtime_records o
         left join users u on u.id = o.user_id
        order by o.created_at desc limit 5`);
  console.log("Joined overtime records:", res3.rows);

  process.exit(0);
}
main();
