import { customersRepository } from "./server/repositories/customers.repository";
import { db, pool } from "./server/db";
import { users } from "./shared/schema";

async function test() {
  try {
    const admin = await db.select().from(users).limit(1);
    if (!admin[0]) throw new Error("No users found");
    const userId = admin[0].id;
    console.log("Using user:", userId);

    console.log("Testing customersRepository.create with null ownerUserId...");
    const customer = await customersRepository.create({
      companyName: "Test Company",
      accountName: "Test Account",
      phone: "123456789",
      email: "test@test.com",
      region: "Other",
      ownerUserId: null as any,
    }, userId); 
    console.log("Success with null owner:", customer.id);

  } catch (err: any) {
    console.error("Crash details:");
    console.error(err.message);
    if (err.stack) console.error(err.stack);
  } finally {
    await pool.end();
  }
}
test();
