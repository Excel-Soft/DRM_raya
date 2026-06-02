import { Router } from "express";
import { db } from "../db";
import { productPostingInvoices, insertProductPostingInvoiceSchema } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { requireRole } from "../auth.middleware";
import { ActivityLogService } from "../services/activity-service";
import { NotificationService } from "../services/notification-service";

export const invoiceRouter = Router();

// GET /api/productPostingInvoices
invoiceRouter.get("/", async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: "Not authenticated" });
        }
        
        let query: any = db.select().from(productPostingInvoices);
        
        if (req.user.roleId === "sales_executive") {
            query = query.where(eq(productPostingInvoices.salesExecId, req.user.userId));
        }
        
        const list = await query.orderBy(desc(productPostingInvoices.createdAt));
        res.json({ success: true, data: list });
    } catch (error) {
        console.error("[Invoices GET]", error);
        res.status(500).json({ success: false, error: "Failed to fetch productPostingInvoices" });
    }
});

// POST /api/productPostingInvoices (Sales Executive creates invoice)
invoiceRouter.post("/", requireRole("sales_executive", "admin"), async (req, res) => {
    try {
        const { amount, projectName, companyName } = req.body;
        const userId = req.user!.userId;

        const [newInvoice] = await db
            .insert(productPostingInvoices)
            .values({
                amount: amount || "0",
                projectName: projectName || null,
                companyName: companyName || null,
                salesExecId: userId,
                status: "PENDING_HOD",
            })
            .returning();

        await ActivityLogService.log({
            userId,
            action: "CREATED",
            resourceType: "Invoice",
            resourceId: newInvoice.id,
            details: `Invoice created with amount ${amount}`,
        });

        res.json({ success: true, data: newInvoice });
    } catch (error) {
        console.error("[Invoices POST]", error);
        res.status(500).json({ success: false, error: "Failed to create invoice" });
    }
});

// PUT /api/productPostingInvoices/:id/approve (HOD & Account Managers approve or reject)
invoiceRouter.put("/:id/approve", requireRole("hod", "account_manager", "admin"), async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body; // action = "APPROVE" | "REJECT"
        const userRole = req.user!.roleId;
        const userId = req.user!.userId;

        const [invoice] = await db.select().from(productPostingInvoices).where(eq(productPostingInvoices.id, id));
        if (!invoice) return res.status(404).json({ success: false, error: "Invoice not found" });

        let newStatus = invoice.status;

        if (action === "REJECT") {
            newStatus = "REJECTED";
            await NotificationService.notify({
                userId: invoice.salesExecId,
                message: `Your invoice was rejected by ${userRole}. Reason: ${reason || 'None provided'}`,
                type: "ERROR"
            });
        } else if (action === "APPROVE") {
            if (userRole === "hod" && newStatus === "PENDING_HOD") {
                newStatus = "PENDING_ACCOUNT";
                await NotificationService.notify({
                    userId: "account_manager",
                    message: `Invoice #${id} approved by HOD. Awaiting your approval.`,
                    type: "INFO",
                    targetUrl: "/account/invoices"
                });
            } else if ((userRole === "account_manager" || userRole === "admin") && newStatus === "PENDING_ACCOUNT") {
                newStatus = "APPROVED";
                await NotificationService.notify({
                    userId: invoice.salesExecId,
                    message: `Invoice #${id} fully approved! You can now create the project in PMS.`,
                    type: "SUCCESS",
                    targetUrl: "/pms/approvals?tab=invoices"
                });
            } else if (userRole === "admin" && newStatus === "PENDING_HOD") {
                 newStatus = "PENDING_ACCOUNT";
            } else {
                return res.status(400).json({ success: false, error: "Invalid approval stage or role" });
            }
        } else {
            return res.status(400).json({ success: false, error: "Invalid action" });
        }

        const [updatedInvoice] = await db
            .update(productPostingInvoices)
            .set({ status: newStatus as any, updatedAt: new Date() })
            .where(eq(productPostingInvoices.id, id))
            .returning();

        await ActivityLogService.log({
            userId,
            action: action === "APPROVE" ? "APPROVED" : "REJECTED",
            resourceType: "Invoice",
            resourceId: invoice.id,
            details: `Invoice ${action.toLowerCase()} by ${userRole}`,
        });

        // Project creation is now handled manually via PMS Pending Approvals


        res.json({ success: true, data: updatedInvoice });
    } catch (error) {
        console.error("[Invoices PUT /approve]", error);
        res.status(500).json({ success: false, error: "Failed to process invoice" });
    }
});
