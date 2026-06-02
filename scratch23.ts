import { pool } from "./server/db";

async function fix() {
  await pool.query("UPDATE drm.invoices SET created_by_user_id = '52d42bc6-be6f-4cce-81bc-132ce0c18f68', payment_method = 'Online Payment' WHERE invoice_number = 'INV-00221'");
  console.log("INV-00221 restored to Qamar Zia");

  const haiderId = "6d406b3c-4055-4c8c-b421-9367f187a672";
  await pool.query(`UPDATE drm.invoices SET created_by_user_id = $1, payment_method = 'Bank Transfer', updated_at = now() WHERE invoice_number = 'INV-00191'`, [haiderId]);
  console.log("INV-00191 assigned to Haider");

  process.exit();
}
fix();
