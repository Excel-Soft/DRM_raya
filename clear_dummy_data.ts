import { db } from "./server/db";
import { productPostingData } from "./shared/schema";

async function clearData() {
  console.log("Deleting all existing product posting data to provide a clean slate for real data...");
  await db.delete(productPostingData);
  console.log("All dummy product posting data cleared!");
  process.exit(0);
}

clearData().catch(err => {
  console.error("Failed to clear data:", err);
  process.exit(1);
});
