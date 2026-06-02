import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [faisal] = await db.select().from(users).where(eq(users.id, "64b855c8-1136-4d7a-bc8c-17f172e65199"));
  console.log("Faisal User Record:", JSON.stringify(faisal, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
