import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [user] = await db.select().from(users).where(eq(users.id, "52d42bc6-be6f-4cce-81bc-132ce0c18f68"));
  console.log("User 52d42bc6-be6f-4cce-81bc-132ce0c18f68:", JSON.stringify(user, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
