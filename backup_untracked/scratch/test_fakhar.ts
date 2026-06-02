import { pool } from '../server/db';
import { customersRepository } from '../server/repositories/customers.repository';
import { ensureSalesTables } from '../server/utils/sales-tables';

async function run() {
    try {
        const userId = "0dccb495-9eb3-4ad8-923d-5e6a9677beff"; // Fakhar
        console.log("Fetching customers for:", userId);
        
        const salesTable = await ensureSalesTables(userId, "sales_executive");
        console.log("Resolved sales table:", salesTable);

        const result = await customersRepository.findByUserId(userId, {}, "sales_executive", salesTable);
        
        console.log("Total returned:", result.total);
        if (result.customers.length > 0) {
            console.log("Sample customer IDs:", result.customers.map(c => c.drmId));
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
run();
