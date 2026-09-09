import { pool } from "../db";

async function checkGmData() {
    try {
        const result = await pool.query(`
      SELECT 
        id, drm_id, member_id, order_id, customer_id, 
        company_name, sales_person_id, sales_person_name,
        package_type, entry_type, amount_usd, status
      FROM gm_entries 
      WHERE is_deleted = false
      ORDER BY created_at DESC 
      LIMIT 5
    `);

        console.log("=== GM Entries Data ===");
        console.log("Total rows:", result.rows.length);
        console.log("\nSample data:");
        result.rows.forEach((row, idx) => {
            console.log(`\n--- Entry ${idx + 1} ---`);
            console.log("ID:", row.id);
            console.log("DRM ID:", row.drm_id);
            console.log("Member ID:", row.member_id);
            console.log("Order ID:", row.order_id);
            console.log("Customer ID:", row.customer_id);
            console.log("Company Name:", row.company_name);
            console.log("Sales Person ID:", row.sales_person_id);
            console.log("Sales Person Name:", row.sales_person_name);
            console.log("Package:", row.package_type);
            console.log("Type:", row.entry_type);
            console.log("Amount USD:", row.amount_usd);
            console.log("Status:", row.status);
        });

        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

checkGmData();
