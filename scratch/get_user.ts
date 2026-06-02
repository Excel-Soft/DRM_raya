import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function check() {
  // Let's get zain's ID
  const u = await db.select().from(users).where(eq(users.name, "fakhar"));
  console.log("Fakhar:", u[0]);
  process.exit(0);
}
check();
