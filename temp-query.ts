import { db } from "./server/db";
import { targetSystemDailyTargets, users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function run() {
  const execId = "awais@excelstech.com";
  
  const userRes = await db.select().from(users).where(eq(users.username, execId));
  const userRole = userRes[0]?.role;
  console.log("userRole:", userRole);

  let defaultActivities = [
    { method: "Mobile", target: "15 () 0%", time: 0 },
  ];

  if (userRole) {
    const userRoleNormalized = userRole.replace(/_/g, ' ').toLowerCase();
    const allTargets = await db.select().from(targetSystemDailyTargets);
    const roleTargets = allTargets.filter(t => t.role.toLowerCase() === userRoleNormalized);
    console.log("roleTargets:", roleTargets);
    
    if (roleTargets.length > 0) {
      defaultActivities = defaultActivities.map(act => {
        const match = roleTargets.find(t => t.method.toLowerCase().includes(act.method.toLowerCase()) || act.method.toLowerCase().includes(t.method.toLowerCase()));
        if (match) {
          return { ...act, target: `${match.target} () 0%` };
        }
        return act;
      });
    }
  }

  console.log("Output:", defaultActivities);
  process.exit(0);
}
run();
