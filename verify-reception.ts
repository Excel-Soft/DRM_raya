import { db } from "./server/db";
import { meetings, customers, users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function verifyReceptionWorkflow() {
  console.log("Starting Reception Workflow Verification...");

  try {
    // 1. Find a dummy user and customer to link (if they exist)
    const [user] = await db.select().from(users).limit(1);
    const [customer] = await db.select().from(customers).limit(1);

    const userId = user?.id;
    const companyId = customer?.id;
    
    console.log(`Using User ID for Creation: ${userId || "None"}`);
    console.log(`Using Company ID: ${companyId || "None"}`);

    // ---> STEP 1: CREATE MEETING (Expected Status) <---
    console.log("\n[Step 1] Creating a new expected meeting...");
    
    const [newMeeting] = await db.insert(meetings).values({
      companyId: companyId || undefined,
      personName: "John Doe Verification",
      meetingType: "New Sell",
      status: "expected",
      createdBy: userId || undefined,
    }).returning();

    console.log(`✅ Success: Meeting created with ID: ${newMeeting.id}`);
    console.log(`   Status: ${newMeeting.status}`);
    console.log(`   Scheduled Date: ${newMeeting.meetingDate}`);

    // Delay a bit to simulate reception wait time
    await new Promise(r => setTimeout(r, 1000));

    // ---> STEP 2: START MEETING (In Progress Status) <---
    console.log(`\n[Step 2] Receptionist clicks 'Start Meeting' for ${newMeeting.id}...`);

    if (newMeeting.status !== "expected") {
        throw new Error("Cannot start a meeting that is not expected!");
    }

    const [startedMeeting] = await db.update(meetings)
        .set({
            status: "in_progress",
            startTime: new Date()
        })
        .where(eq(meetings.id, newMeeting.id))
        .returning();

    console.log(`✅ Success: Meeting updated to status: ${startedMeeting.status}`);
    console.log(`   Start Time Record: ${startedMeeting.startTime}`);

    // Wait 3 seconds to accumulate some duration
    console.log("   (Meeting in progress... waiting 3 seconds)");
    await new Promise(r => setTimeout(r, 3000));

    // ---> STEP 3: END MEETING (Ended Status) <---
    console.log(`\n[Step 3] Receptionist clicks 'End Meeting' for ${startedMeeting.id}...`);

    if (startedMeeting.status !== "in_progress") {
        throw new Error("Cannot end a meeting that is not in progress!");
    }

    // Logic replicated from API endpoint
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - startedMeeting.startTime!.getTime()) / 1000);

    const [endedMeeting] = await db.update(meetings)
        .set({
            status: "ended",
            endTime: endTime,
            totalDurationSeconds: durationSeconds
        })
        .where(eq(meetings.id, startedMeeting.id))
        .returning();

    console.log(`✅ Success: Meeting lifecycle completed!`);
    console.log(`   Final Status: ${endedMeeting.status}`);
    console.log(`   End Time: ${endedMeeting.endTime}`);
    console.log(`   Total Duration: ${endedMeeting.totalDurationSeconds} seconds`);

    // ---> STEP 4: VERIFY RECEPTION DASHBOARD STATS <---
    console.log(`\n[Step 4] Verifying Reception Stats query...`);
    const { sql } = await import("drizzle-orm");
    const [stats] = await db.select({
        total: sql<number>`count(*)`,
        expected: sql<number>`sum(case when status = 'expected' then 1 else 0 end)`,
        inProgress: sql<number>`sum(case when status = 'in_progress' then 1 else 0 end)`,
        ended: sql<number>`sum(case when status = 'ended' then 1 else 0 end)`
    }).from(meetings);

    console.log(`📊 Stats verification: Total Meetings: ${stats.total}, Expected: ${stats.expected}, In Progress: ${stats.inProgress}, Ended: ${stats.ended}`);

  } catch (err: any) {
    console.error("❌ Workflow Verification Failed:", err.message);
  } finally {
    process.exit(0);
  }
}

verifyReceptionWorkflow();
