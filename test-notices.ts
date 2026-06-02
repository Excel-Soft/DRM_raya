import { db } from "./server/db";
import { notices } from "./shared/schema";

async function testNotices() {
  console.log("Testing Notice Insertion");
  try {
    const [inserted] = await db.insert(notices).values({
      title: "Test Notice",
      description: "Test description",
      status: "Active",
      assignedByUserId: "64b855c8-1136-4d7a-bc8c-17f172e65199",
      assignedToRole: "Reception Manager",
      assignedToDepartment: "Reception"
    }).returning();
    console.log("Successfully inserted:", inserted);
  } catch (error) {
    console.error("Notice insertion failed:", error);
  }
  process.exit();
}

testNotices();
