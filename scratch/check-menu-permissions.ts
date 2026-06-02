import { db } from "../server/db";
import { urlPermissions } from "../shared/schema";

async function main() {
  const perms = await db.select().from(urlPermissions);
  console.log("All URL/Menu Permissions:", JSON.stringify(perms, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
