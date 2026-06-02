import { Router } from "express";
import { db } from "../db";
import { projects, projectDocuments, productPostingInvoices } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "../auth.middleware";
import { ActivityLogService } from "../services/activity-service";
import { NotificationService } from "../services/notification-service";
import {
    getOrCreateProductPostingWorkflow,
    getWorkflowQueueForManager,
    transitionWorkflowByProject,
} from "../services/product-posting-workflow.service";

export const projectDocRouter = Router();

projectDocRouter.get("/documents/pending", requireRole("product_posting_manager", "admin"), async (_req, res) => {
    try {
        const queue = await getWorkflowQueueForManager();
        const pending = queue.flatMap((item) =>
            (item.documents || [])
                .filter((doc: any) => doc.status === "PENDING")
                .map((doc: any) => ({
                    ...doc,
                    projectName: item.project.name,
                    projectPhase: item.currentPhase,
                    companyName: item.project.companyName,
                }))
        );
        res.json({ success: true, data: pending });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch pending documents" });
    }
});

// GET /api/projects/:id/documents
projectDocRouter.get("/:id/documents", async (req, res) => {
    try {
        const list = await db
            .select()
            .from(projectDocuments)
            .where(eq(projectDocuments.projectId, req.params.id))
            .orderBy(desc(projectDocuments.createdAt));
        res.json({ success: true, data: list });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch documents" });
    }
});

// GET /api/projects/:id/details
projectDocRouter.get("/:id/details", async (req, res) => {
    try {
        const { projectDetails } = await import("../../shared/schema");
        const [details] = await db
            .select()
            .from(projectDetails)
            .where(eq(projectDetails.projectId, req.params.id))
            .limit(1);
        
        const [project] = await db.select().from(projects).where(eq(projects.id, req.params.id));
        
        res.json({ success: true, data: { ...details, project } });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to fetch project details" });
    }
});

// POST /api/projects/:id/documents (Sales Executive uploads docs)
// Allow any authenticated user (sales_executive, admin, or active role = sales_executive)
projectDocRouter.post("/:id/documents", async (req, res) => {
    if (!req.user) return res.status(401).json({ success: false, error: "Not authenticated" });
    const callerRole = (req.user as any).activeRoleId || req.user.roleId || (req.user as any).role || "";
    console.log(`[DocUpload] Caller role: '${callerRole}', userId: ${req.user.userId}`);
    try {
        const { id: projectId } = req.params;
        const { 
            documentUrl,
            packageName,
            minisiteUrl,
            phone,
            mobile,
            address,
            reference,
            categories,
            detailNotes,
            evidenceUrl
        } = req.body;
        const userId = req.user!.userId;

        const [projectData] = await db
            .select({
                project: projects,
                invoice: productPostingInvoices
            })
            .from(projects)
            .leftJoin(productPostingInvoices, eq(projects.invoiceId, productPostingInvoices.id))
            .where(eq(projects.id, projectId));

        if (!projectData) return res.status(404).json({ success: false, error: "Project not found" });
        const { project, invoice } = projectData;

        await getOrCreateProductPostingWorkflow(projectId);

        // Save Project Details — UPSERT so re-upload doesn't fail on unique constraint
        const { projectDetails } = await import("../../shared/schema");
        await db.insert(projectDetails).values({
            projectId,
            packageName,
            minisiteUrl,
            phone,
            mobile,
            address,
            reference,
            categories,
            detailNotes,
            evidenceUrl
        } as any).onConflictDoUpdate({
            target: (projectDetails as any).projectId,
            set: {
                packageName,
                minisiteUrl,
                phone,
                mobile,
                address,
                reference,
                categories,
                detailNotes,
                evidenceUrl
            }
        });

        const [newDoc] = await db
            .insert(projectDocuments)
            .values({
                projectId,
                documentUrl: documentUrl || evidenceUrl || "none", // Fallback to evidenceUrl if provided
                uploadedByUserId: userId,
                status: "PENDING",
            } as any)
            .returning();

        await ActivityLogService.log({
            userId,
            action: "UPLOADED",
            resourceType: "ProjectDocument",
            resourceId: newDoc.id,
            details: `New requirements and PROJECT DETAIL uploaded for project '${project.name}'`,
        });

        // Determine workflow routing based on project type
        // Priority: invoice.projectName (most reliable) → project.name → form fields
        const invName = (invoice?.projectName || "").toLowerCase();
        const projName = (project.name || "").toLowerCase();
        
        // Explicit check based on invoice type first (most reliable)
        const isMinisite = invName.includes("minisite") || invName.includes("mini site") ||
            projName.includes("minisite") || projName.includes("mini site") ||
            (minisiteUrl && minisiteUrl.trim() !== "");
        
        const isListingPage = invName.includes("listing") ||
            projName.includes("listing");

        // Product Posting is the default if it's a product_posting invoice
        const isProductPosting = invName.includes("product posting") || 
            projName.includes("product posting");

        console.log(`[ProjectDoc] Detection - invName: '${invName}', projName: '${projName}', isMinisite: ${isMinisite}, isListingPage: ${isListingPage}, isProductPosting: ${isProductPosting}`);

        let nextPhase: any = "PENDING_PROJECT";
        let targetRole = "product_posting_manager";

        if (isMinisite || isListingPage) {
            nextPhase = "DATA_VERIFY";
            targetRole = "dd_manager";
        }


        // Send notification ONLY to the correct manager for this project type
        await NotificationService.notify({
            userId: targetRole,
            message: `New ${isMinisite ? 'Minisite' : isListingPage ? 'Listing Page' : 'Product Posting'} project requirements uploaded for '${project.name}'. Pending verification.`,
            type: "INFO",
            targetUrl: targetRole === "dd_manager" ? "/dashboard/dd-manager" : "/product-posting/manager"
        });

        // Do NOT send cross-notifications: Minisite/Listing → only DD Manager; Product Posting → only PP Manager


        await transitionWorkflowByProject({
            projectId,
            nextPhase,
            actorUserId: userId,
            action: "DOCUMENT_UPLOADED",
            patch: {
                salespersonUploadedAt: new Date(),
            }
        });

        res.json({ success: true, data: newDoc });
    } catch (error) {
        console.error("Doc upload error:", error);
        res.status(500).json({ success: false, error: "Failed to upload document", details: (error as any)?.message });
    }
});

// PUT /api/projects/documents/:docId/verify (Product Posting Manager)
projectDocRouter.put("/documents/:docId/verify", requireRole("product_posting_manager", "dd_manager", "qa_manager", "admin"), async (req, res) => {
    try {
        const { docId } = req.params;
        const { action, reason } = req.body; // action: "APPROVE" | "REJECT"
        const userId = req.user!.userId;

        console.log(`[ProjectDoc] VERIFY - docId: ${docId}, action: ${action}, user: ${userId}`);

        const [doc] = await db.select().from(projectDocuments).where(eq(projectDocuments.id, docId));
        if (!doc) {
            console.log(`[ProjectDoc] VERIFY FAILED - Document ${docId} not found in DB`);
            return res.status(404).json({ success: false, error: "Document not found" });
        }

        const [project] = await db.select().from(projects).where(eq(projects.id, doc.projectId));

        const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

        const [updatedDoc] = await db
            .update(projectDocuments)
            .set({ status: newStatus as any })
            .where(eq(projectDocuments.id, docId))
            .returning();

        await ActivityLogService.log({
            userId,
            action: newStatus,
            resourceType: "ProjectDocument",
            resourceId: doc.id,
            details: `Document verified. Reason: ${reason || 'N/A'}`
        });

        if (newStatus === "REJECTED") {
            await transitionWorkflowByProject({
                projectId: doc.projectId,
                nextPhase: "PENDING_PROJECT",
                actorUserId: userId,
                action: "DOCUMENT_REJECTED",
                remarks: reason,
            });
            // Notify uploader
            await NotificationService.notify({
                userId: doc.uploadedByUserId,
                message: `Your document for project was rejected. Reason: ${reason}. Please re-upload.`,
                type: "ERROR",
                targetUrl: "/pms/approvals"
            });
            // Notify original sales executive (project owner)
            if (project?.ownerUserId && project.ownerUserId !== doc.uploadedByUserId) {
                await NotificationService.notify({
                    userId: project.ownerUserId,
                    message: `Documents for your project '${project.name}' were rejected. Reason: ${reason}. Please ensure they are re-uploaded.`,
                    type: "ERROR",
                    targetUrl: "/pms/approvals"
                });
            }
        } else {
            await transitionWorkflowByProject({
                projectId: doc.projectId,
                nextPhase: "PROJECT_OVERVIEW",
                actorUserId: userId,
                action: "DATA_VERIFIED",
                patch: {
                    dataVerifiedAt: new Date(),
                    managerUserId: userId,
                }
            });
            await NotificationService.notify({
                userId: doc.uploadedByUserId,
                message: `Your document for project was approved and is now ready for task assignment.`,
                type: "SUCCESS"
            });
            await NotificationService.notify({
                userId: "product_posting_manager",
                message: `A project document was approved and is now ready for task assignment.`,
                type: "INFO",
                targetUrl: "/product-posting/manager",
            });
        }

        res.json({ success: true, data: updatedDoc });
    } catch (error) {
        res.status(500).json({ success: false, error: "Failed to verify document" });
    }
});
