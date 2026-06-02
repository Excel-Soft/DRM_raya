import { db } from './server/db';
import { targetSystemUserTargets } from './shared/schema';

async function test() {
  const allUserTargets = await db.select().from(targetSystemUserTargets);
  console.log("Total length:", allUserTargets.length);
  if (allUserTargets.length > 0) {
    console.log("First element keys:", Object.keys(allUserTargets[0]));
    console.log("First element values:", allUserTargets[0]);
  }
  process.exit(0);
}
test();
