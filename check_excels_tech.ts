import { db } from "./server/db";
import { projects, projectDocuments, users, notifications } from "./shared/schema";
import { ilike, eq, desc } from "drizzle-orm";

async function checkExcelsTech() {
    console.log("Checking for 'excels tech' project...");
    
    // Find project
    const projectList = await db.select().from(projects).where(ilike(projects.name, "%excels tech%"));
    if (projectList.length === 0) {
        console.log("No project found with 'excels tech' in the name.");
    } else {
        const p = projectList[0];
        console.log(`Found project: ID=${p.id}, Name=${p.name}, OwnerUserId=${p.ownerUserId}`);
        
        // Find owner user
        const ownerList = await db.select().from(users).where(eq(users.id, p.ownerUserId));
        if (ownerList.length > 0) {
            console.log(`Owner User: ID=${ownerList[0].id}, Username=${ownerList[0].username}, Role=${ownerList[0].role}`);
        } else {
            console.log(`Owner User not found for ID: ${p.ownerUserId}`);
        }
        
        // Find documents
        const docs = await db.select().from(projectDocuments).where(eq(projectDocuments.projectId, p.id)).orderBy(desc(projectDocuments.createdAt));
        if (docs.length > 0) {
            console.log(`Found ${docs.length} documents.`);
            for (const doc of docs) {
                console.log(`- Doc ID=${doc.id}, Status=${doc.status}, UploadedBy=${doc.uploadedByUserId}`);
                const uploaderList = await db.select().from(users).where(eq(users.id, doc.uploadedByUserId));
                if (uploaderList.length > 0) {
                    console.log(`  Uploader: ${uploaderList[0].username} (Role: ${uploaderList[0].role})`);
                }
            }
        } else {
            console.log("No documents found for this project.");
        }
        
        // Check notifications for owner
        const notifs = await db.select().from(notifications).where(eq(notifications.userId, p.ownerUserId)).orderBy(desc(notifications.createdAt)).limit(5);
        console.log(`\nRecent notifications for Owner (${p.ownerUserId}):`);
        notifs.forEach(n => console.log(`- [${n.createdAt}] ${n.message}`));
    }
    
    process.exit(0);
}

checkExcelsTech();
