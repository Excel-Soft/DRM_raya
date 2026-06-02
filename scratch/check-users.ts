import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const allUsers = await db.select().from(users);
  console.log("All Users:");
  for (const user of allUsers) {
    console.log(`ID: ${user.id}, Username: ${user.username}, FullName: ${user.fullName}, RoleId: ${user.roleId}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
