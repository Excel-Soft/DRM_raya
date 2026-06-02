import { pool } from "./server/db";
async function main() {
  const listSql = `select id, user_id as "userId", task_title as "taskTitle", time_spent as "timeSpent", task_details as "taskDetails", date, status, reviewed_by_user_id as "reviewedByUserId", rejection_reason as "rejectionReason", created_at as "createdAt"
                         from overtime_records
                         order by created_at desc`;
  const res = await pool.query(listSql);
  console.log(res.rows);
  
  const res2 = await pool.query(`select o.id, o.user_id, o.date, o.hours, o.status, o.reason, o.approved_by,
              o.created_at, o.updated_at, u.full_name
         from overtime_records o
         left join users u on u.id = o.user_id
        order by o.created_at desc`);
  console.log("FROM OVERTIME REPO:");
  console.log(res2.rows);

  process.exit(0);
}
main();
