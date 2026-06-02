import { db } from "../server/db";
import { urlPermissions } from "../shared/schema";
import { eq } from "drizzle-orm";

async function checkPermissions() {
    try {
        const allPerms = await db.select().from(urlPermissions);
        console.log("All Permissions in DB:");
        allPerms.forEach(p => {
            console.log(`- Name: ${p.name}, Path/Key: ${p.path}, Roles: ${JSON.stringify(p.allowedRoleIds)}`);
        });

        const reportPerm = allPerms.find(p => p.name === "User Reports" || p.path === "User Reports");
        if (reportPerm) {
            console.log("\nFound User Reports Permission:");
            console.log(JSON.stringify(reportPerm, null, 2));
        } else {
            console.log("\nUser Reports Permission NOT found in DB.");
        }
    } catch (err) {
        console.error("Error checking permissions:", err);
    }
}

checkPermissions();
