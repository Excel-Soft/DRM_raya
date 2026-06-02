import { db } from "../server/db";
import { productPostingWorkflows, projects, tasks, users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const workflows = await db.select().from(productPostingWorkflows);
  console.log("All Product Posting Workflows:", JSON.stringify(workflows, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
