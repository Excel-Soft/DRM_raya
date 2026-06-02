import { pool } from '../server/db'; 
import { ensureSalesTables } from '../server/utils/sales-tables';
async function run() { 
    try {
        const userId = "0dccb495-9eb3-4ad8-923d-5e6a9677beff";
        console.log("Calling ensureSalesTables");
        const table = await ensureSalesTables(userId, "sales_executive");
        console.log("Returned table:", table);
    } catch(e) {
        console.error("Error:", e);
    }
    process.exit(0); 
} 
run();
