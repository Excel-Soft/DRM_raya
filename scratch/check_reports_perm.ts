import { db } from "../server/db";
import { urlPermissions } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const perms = await db.select().from(urlPermissions).where(eq(urlPermissions.path, "reports"));
  console.log(JSON.stringify(perms, null, 2));
  process.exit(0);
}
main();
