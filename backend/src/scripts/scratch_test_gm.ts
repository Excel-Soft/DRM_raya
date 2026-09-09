import { pool } from "../db";

async function run() {
  try {
    const userRes = await pool.query(
      `INSERT INTO drm.users (username, email, role_id, role, branch, is_active, full_name, password_hash)
       VALUES ('test_gm_user', 'test_gm_user@test.local', 'sales_executive', 'sales_executive', 'Lahore Gulburg', true, 'Test User', 'hash') RETURNING id`
    );
    const userId = userRes.rows[0].id;
    console.log("Seeded user ID:", userId);

    const insertSql = `
      INSERT INTO drm.gm_entries (
        id, gm_type, drm_id, member_id, order_id, company_name, package_type, entry_type,
        amount, amount_usd, customer_dollar, dollar_rate, amount_pkr, alibaba_discount_usd,
        final_order_usd, extra_discount_usd, extra_discount_pkr, status, payment_status,
        is_loan, is_partial_payment, notes, dropout, extension, payment_proof_url, created_by,
        customer_id, installments, sales_person_name, sales_person_id, created_at, updated_at,
        is_deleted, approval_status, created_by_role
      )
      VALUES (
        gen_random_uuid(), 'GM', $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28, now(), now(), false, 'pending_hod', $29
      )
      RETURNING *
    `;
    const values = [
      "DRM-999", "MEM-999", "ORD-999", "Company 999", "Basic", "New",
      100, 100, 100, 280, 28000, 0, 100, 0, 0,
      "Pending", "Pending", 0, 0,
      "notes", null, null, null,
      userId, null, "[]",
      "Sales Name", userId, "sales_executive"
    ];
    const r = await pool.query(insertSql, values);
    console.log("SUCCESS! Inserted GM ID:", r.rows[0].id, "status:", r.rows[0].status);
  } catch (err) {
    console.error("Error inserting GM:", err);
  } finally {
    process.exit(0);
  }
}

run();
