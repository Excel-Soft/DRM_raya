import { db } from "../server/db";
import { urlPermissions } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const perms = await db.select().from(urlPermissions).where(eq(urlPermissions.path, "reports"));
  if (perms.length > 0) {
    const roles = new Set(perms[0].allowedRoleIds || []);
    roles.add("sales_executive");
    roles.add("service_executive");
    roles.add("lead_executive");
    roles.add("sales_manager");
    roles.add("software_manager");
    
    await db.update(urlPermissions).set({
      allowedRoleIds: Array.from(roles)
    }).where(eq(urlPermissions.path, "reports"));
    console.log("Permissions updated!");
  } else {
    console.log("Not found");
  }
  process.exit(0);
}
main();
