import { db } from "../server/db";
import { notifications, users } from "../shared/schema";
import { desc } from "drizzle-orm";

async function main() {
  const notifs = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(30);
  console.log("Recent 30 Notifications:");
  for (const n of notifs) {
    const [user] = await db.select().from(users).where(eq(users.id, n.userId));
    console.log(`[${n.createdAt}] To User: ${user?.fullName} (${user?.username}), Type: ${n.type}, Status: ${n.readStatus}\n  Msg: ${n.message}\n  Url: ${n.targetUrl}`);
  }
}

import { eq } from "drizzle-orm";

main().catch(console.error).finally(() => process.exit(0));
