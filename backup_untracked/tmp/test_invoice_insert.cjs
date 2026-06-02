const { Pool } = require('pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.tdofmdaeahxfgmlmjgbp:SajjadAgent2026%21@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

// This exactly simulates what the frontend sends when saving an invoice
// Based on the screenshot provided by the user:
// - accountHolder: "john"
// - company: "Nightspam"  
// - email: "nightspam@gmail.com"
// - leadId: comes from lead.id (which should be a UUID from the DB)
// - product: "Domain Registration" (default product, id: "def-1")

const testPayload = {
    leadId: "c023cc36-7f6a-4a5a-92ff-39ab20fbedac", // Nightspam customer id from DB
    customerId: null,
    accountHolder: "john",
    company: "Nightspam",
    email: "nightspam@gmail.com",
    contact: "03000000000",
    gstPercent: 10,
    discountType: "PERCENT",
    discountValue: 0,
    items: [
        {
            productId: "Domain Registration",
            detail: "ok",
            unitPrice: 0.5,
            quantity: 1,
            startYear: 2026,
            endYear: 2026
        }
    ]
};

async function main() {
    const client = await pool.connect();
    try {
        await client.query("SET search_path TO drm, public");
        console.log("Starting test insertion...");

        // Manually compute what the server would compute
        const subAmount = testPayload.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const gstAmount = subAmount * (testPayload.gstPercent / 100);
        const totalAmount = subAmount + gstAmount;
        const discount = 0;
        const grandTotal = totalAmount;
        const pkrTotal = grandTotal;

        console.log("Computed totals:", { subAmount, gstAmount, totalAmount, grandTotal });

        await client.query('BEGIN');

        const result = await client.query(`
      INSERT INTO quotations (
        customer_id, lead_id, account_holder, company, email, contact, delivery_time,
        gst_percent, discount_type, discount_value, sub_amount, gst_amount, total_amount,
        grand_total, pkr_total, payment_term_percent, save_status, note, amount, created_by, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20, now())
      RETURNING *
    `, [
            null, // customer_id
            testPayload.leadId, // lead_id
            testPayload.accountHolder,
            testPayload.company,
            testPayload.email,
            testPayload.contact,
            null, // delivery_time
            testPayload.gstPercent,
            testPayload.discountType,
            testPayload.discountValue,
            subAmount,
            gstAmount,
            totalAmount,
            grandTotal,
            pkrTotal,
            0, // payment_term_percent
            'pending_hod', // save_status
            null, // note
            totalAmount, // amount
            'test-user-id', // created_by (this is where user.userId would be used)
        ]);

        console.log("\n✅ Quotation inserted successfully!");
        console.log("ID:", result.rows[0].id);

        // Now insert the item
        const itemResult = await client.query(`
      INSERT INTO quotation_items (
        quotation_id, product_id, detail, min_time, max_time, unit_price,
        quantity, item_total, start_year, end_year, domain_url
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [
            result.rows[0].id,
            "Domain Registration",
            "ok",
            null, null,
            0.5, 1, 0.5,
            2026, 2026,
            null
        ]);
        console.log("✅ Item inserted successfully!");
        console.log("Item ID:", itemResult.rows[0].id);

        await client.query('COMMIT');
        console.log("\n✅ Full transaction COMMITTED successfully!");

        // Cleanup
        await client.query("DELETE FROM quotation_items WHERE quotation_id = $1", [result.rows[0].id]);
        await client.query("DELETE FROM quotations WHERE id = $1", [result.rows[0].id]);
        console.log("Test data cleaned up.");

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("\n❌ ERROR:", err.message);
        console.error("Code:", err.code);
        console.error("Detail:", err.detail);
        console.error("Hint:", err.hint);
        console.error("Column:", err.column);
        console.error("Table:", err.table);
        console.error("Constraint:", err.constraint);
        console.error("Full Error:", err);
    } finally {
        client.release();
        await pool.end();
    }
}

main();
