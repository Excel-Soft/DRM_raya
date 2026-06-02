import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const [user] = await db.select().from(users).where(eq(users.id, "9ea6656a-bed3-4549-b60d-cba847c1c5ab"));
  console.log("User 9ea6656a-bed3-4549-b60d-cba847c1c5ab:", JSON.stringify(user, null, 2));

  const [userFakhar] = await db.select().from(users).where(eq(users.id, "0dccb495-9eb3-4ad8-923d-5e6a9677beff"));
  console.log("User Fakhar (0dccb495-9eb3-4ad8-923d-5e6a9677beff):", JSON.stringify(userFakhar, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
