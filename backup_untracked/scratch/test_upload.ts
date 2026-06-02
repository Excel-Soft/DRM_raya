import { db, pool } from "../server/db";
import { projects, productPostingWorkflows } from "../shared/schema";
import { transitionWorkflowByProject } from "../server/services/product-posting-workflow.service";
import { eq } from "drizzle-orm";

async function testUpload() {
    console.log("--- SIMULATING DOCUMENT UPLOAD FOR MINI SITE ---");
    
    // Using Proj-irfan-•-talha (8eec253c-5028-4759-9e7f-3964200418c0) 
    // which was null phase
    const projectId = "8eec253c-5028-4759-9e7f-3964200418c0";
    const userId = "0dccb495-9eb3-4ad8-923d-5e6a9677beff"; // fakhar, sales_executive
    
    try {
        const result = await transitionWorkflowByProject({
            projectId,
            nextPhase: "DATA_VERIFY",
            actorUserId: userId,
            action: "DOCUMENT_UPLOADED",
            patch: {
                salespersonUploadedAt: new Date(),
            }
        });
        
        console.log("Transition result:");
        console.log(result);
        
        // Verify project status is Active
        const [proj] = await db.select().from(projects).where(eq(projects.id, projectId));
        console.log("Project status:", proj.status);
        
    } catch (error) {
        console.error("Transition failed:", error);
    }

    process.exit(0);
}

testUpload().catch(err => {
    console.error(err);
    process.exit(1);
});
