import { db } from "../server/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const user = await db.select().from(users).where(eq(users.id, "4fec24fc-8c7a-4066-8126-578f66164d00"));
  console.log(JSON.stringify(user, null, 2));
  process.exit(0);
}
main();
