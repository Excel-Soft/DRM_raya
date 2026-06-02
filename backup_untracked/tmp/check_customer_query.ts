import { customersRepository } from "../server/repositories/customers.repository";
import { pool } from "../server/db";

async function run() {
    try {
        const res = await customersRepository.findByUserId('9ea6656a-bed3-4549-b60d-cba847c1c5ab', {
            page: 1,
            pageSize: 10,
            sortBy: "createdAt",
            sortOrder: "desc"
        }, "admin");
        console.log("Total:", res.total);
        console.log("Customers length:", res.customers.length);
    } catch (err) {
        console.error("Error executing query:", err);
    }
    process.exit(0);
}
run();
