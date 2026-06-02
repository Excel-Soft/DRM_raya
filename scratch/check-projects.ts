import { db } from "../server/db";
import { projects } from "../shared/schema";
import { ilike, or, eq } from "drizzle-orm";

async function main() {
  const allProjects = await db.select().from(projects).where(
    or(
      eq(projects.id, "e93994ea-7c38-4f79-8d58-4f74835450aa"),
      ilike(projects.name, "%Excels tech%")
    )
  );
  console.log("Selected Projects:", JSON.stringify(allProjects, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
