
import { pool } from "../db";
import { generateDrmId } from "../utils/drm-id-utils";

async function migrate() {
    const client = await pool.connect();
    try {
        console.log("Starting DRM ID migration (Format: pkABCD1234)...");

        await client.query("BEGIN");

        // 1. Customers
        const customers = await client.query("SELECT id, company_name, country, person_name FROM customers");
        for (const customer of customers.rows) {
            const newDrmId = generateDrmId(
                customer.company_name,
                customer.country, // Ignored by revert logic
                customer.person_name, // Ignored by revert logic
                customer.id
            );
            await client.query("UPDATE customers SET drm_id = $1 WHERE id = $2", [newDrmId, customer.id]);
        }
        console.log(`Updated ${customers.rowCount} customers.`);

        // 2. Temp Contacts
        const tempContacts = await client.query("SELECT id, country, person_name FROM temp_contacts");
        for (const contact of tempContacts.rows) {
            const newDrmId = generateDrmId(
                contact.person_name, // Use person_name as companyName
                contact.country,
                contact.person_name,
                contact.id
            );
            await client.query("UPDATE temp_contacts SET drm_id = $1 WHERE id = $2", [newDrmId, contact.id]);
        }
        console.log(`Updated ${tempContacts.rowCount} temp contacts.`);

        // 3. GM Entries
        const gmEntries = await client.query(`
      SELECT g.id, g.company_name, g.member_id as person_name, 
             c.country 
      FROM gm_entries g
      LEFT JOIN customers c ON g.customer_id = c.id
    `);

        for (const entry of gmEntries.rows) {
            const newDrmId = generateDrmId(
                entry.company_name,
                entry.country,
                entry.person_name,
                entry.id
            );
            await client.query("UPDATE gm_entries SET drm_id = $1 WHERE id = $2", [newDrmId, entry.id]);
        }
        console.log(`Updated ${gmEntries.rowCount} GM entries.`);

        await client.query("COMMIT");
        console.log("Migration completed successfully.");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Migration failed:", error);
        process.exit(1);
    } finally {
        client.release();
        process.exit(0);
    }
}

migrate();
