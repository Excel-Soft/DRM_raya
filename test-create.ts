import { customersRepository } from "./server/repositories/customers.repository";
import { pool } from "./server/db";

async function test() {
  try {
    console.log("Testing customersRepository.create...");
    const customer = await customersRepository.create({
      companyName: "Test Company",
      accountName: "Test Account",
      phone: "123456789",
      email: "test@test.com",
      region: "Other",
      ownerUserId: null as any,
    }, "00000000-0000-0000-0000-000000000000"); // some dummy UUID for creator
    console.log("Success:", customer);
  } catch (err: any) {
    console.error("Crash details:");
    console.error(err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await pool.end();
  }
}
test();
