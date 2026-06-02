import { db } from "./server/db";
import { restrictedKeywords } from "./shared/schema";

async function clearRestrictedKeywords() {
    console.log("Clearing fake restricted keywords...");
    try {
        await db.delete(restrictedKeywords);
        console.log("Deleted all restricted keywords successfully.");
    } catch (e: any) {
        console.error("Error clearing restricted keywords:", e.message);
    }
    process.exit(0);
}

clearRestrictedKeywords();
