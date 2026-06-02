import { db } from "./server/db";
import { targetSystemUserTargets, targetSystemDailyTargets, users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function run() {
  console.log("Starting E2E Workflow Test for Target System...");
  
  // 1. Find a Service Executive
  const execId = "awais@excelstech.com";
  const userRes = await db.select().from(users).where(eq(users.username, execId));
  const user = userRes[0];
  if (!user) {
    console.log("No user found");
    process.exit(1);
  }
  
  console.log(`\n[STEP 1] Using User: ${user.fullName} (${user.role})`);
  
  // 2. Insert Day Target
  console.log(`\n[STEP 2] Adding Day Target for Service Executive...`);
  await db.insert(targetSystemDailyTargets).values({
    role: "Service Executive",
    method: "Whatsapp",
    target: 50,
  });
  console.log("-> Inserted Whatsapp target = 50 for Service Executive");
  
  // 3. Insert Target For Role
  console.log(`\n[STEP 3] Adding Role Targets (AB and VAS)...`);
  await db.insert(targetSystemUserTargets).values({
    userId: user.id.toString(),
    targetName: "Test AB Target",
    category: "AB New Terget", 
    target: "50000",
    price: "1000",
    bonus: "5%",
    vas: "0",
    kwa: "0",
    reward: "500",
    total: "1500"
  });
  console.log("-> Inserted 'AB New Terget' target");
  
  await db.insert(targetSystemUserTargets).values({
    userId: user.id.toString(),
    targetName: "VAS Huge Goal",
    category: "VAS",
    target: "100000",
    price: "5000",
    bonus: "10%",
    vas: "100",
    kwa: "0",
    reward: "1000",
    total: "6000"
  });
  console.log("-> Inserted 'VAS' target");

  // 4. Simulate Dashboard Fetch
  console.log(`\n[STEP 4] Simulating Service Executive Activities API...`);
  let defaultActivities = [
    { method: "Whatsapp", target: "20 () 0%", time: 0 },
    { method: "Mobile", target: "15 () 0%", time: 0 }
  ];
  
  const allDayTargets = await db.select().from(targetSystemDailyTargets);
  const userRoleNormalized = "service executive";
  const roleTargets = allDayTargets.filter(t => t.role.toLowerCase() === userRoleNormalized);
  
  if (roleTargets.length > 0) {
    defaultActivities = defaultActivities.map(act => {
      const match = roleTargets.find(t => t.method.toLowerCase().includes(act.method.toLowerCase()) || act.method.toLowerCase().includes(t.method.toLowerCase()));
      if (match) {
        return { ...act, target: `${match.target} () 0%` };
      }
      return act;
    });
  }
  console.log("-> Final Activities Result:");
  console.log(defaultActivities);

  // 5. Simulate Dashboard Target Widget
  console.log(`\n[STEP 5] Simulating Service Executive Targets API...`);
  const allUserTargets = await db.select().from(targetSystemUserTargets).where(eq(targetSystemUserTargets.userId, user.id));
  
  const ab = allUserTargets.filter(t => t.category && t.category.toLowerCase().includes("ab new")).map(t => ({
    target: t.targetName,
    bonus: t.bonus,
    price: t.price,
    reward: t.reward,
    kwa: t.kwa,
    vas: t.vas
  }));

  const vas = allUserTargets.filter(t => t.category && t.category.toLowerCase().includes("vas")).map(t => ({
    target: t.targetName,
    bonus: t.bonus,
    price: t.price,
    reward: t.reward
  }));

  const overall = [
      { name: "LD", value: 0 },
      { name: "QF", value: 0 },
  ];

  console.log("-> Final Target Widget Result:");
  console.log({
    ab,
    vas,
    overall
  });
  
  console.log("\n✅ E2E Workflow Test Complete");
  process.exit(0);
}
run().catch(console.error);
