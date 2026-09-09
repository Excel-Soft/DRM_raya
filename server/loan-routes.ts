import type { Express } from "express";
import { loanRepository } from "./repositories/loan.repository";
import { insertLoanRequestSchema, insertLoanRequestAdminSchema } from "@shared/schema";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isManagerialRole, isHodAllowed, normalizeRole, ROLES } from "./utils/role-utils";
import { requireActionPermission } from "./middleware/action-permission";
import { ActivityLogService } from "./services/activity-service";

// Resolve the caller's effective (active) role from the auth payload.
function callerRole(req: any): string {
  return (req.user?.activeRoleId ?? req.user?.roleId ?? req.user?.role ?? "") as string;
}

export function registerLoanRoutes(app: Express) {
  // GET /api/loans - Get all loan requests for the current user
  app.get("/api/loans", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const records = await loanRepository.findByUserId(userId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching loan requests:", error);
      res.status(500).json({ error: "Failed to fetch loan requests" });
    }
  });

  // GET /api/admin/loans - Get all loan requests for the manager
  app.get("/api/admin/loans", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check if user has admin permissions
      const userRole = req.user.roleId?.toLowerCase();
      const isAdmin = ["admin", "super_hod", "hod", "manager", "assistant_manager"].includes(userRole);

      if (!isAdmin) {
        console.error("[LOAN_ADMIN] Non-admin user attempted access to GET /api/admin/loans:", req.user.userId, userRole);
        return res.status(403).json({ error: "Admin access required" });
      }

      const records = await loanRepository.findAll();
      res.json(records);
    } catch (error) {
      console.error("Error fetching all loan requests:", error);
      res.status(500).json({ error: "Failed to fetch loan requests" });
    }
  });

  // GET /api/loans/stats - Get loan statistics for the current user
  app.get("/api/loans/stats", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const stats = await loanRepository.getStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching loan stats:", error);
      res.status(500).json({ error: "Failed to fetch loan statistics" });
    }
  });

  // GET /api/loans/active - Get active loan for the current user
  app.get("/api/loans/active", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const activeLoan = await loanRepository.getActiveLoan(userId);
      res.json(activeLoan);
    } catch (error) {
      console.error("Error fetching active loan:", error);
      res.status(500).json({ error: "Failed to fetch active loan" });
    }
  });

  // GET /api/loans/:id - Get a specific loan request
  app.get("/api/loans/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const record = await loanRepository.findById(req.params.id);

      if (!record) {
        return res.status(404).json({ error: "Loan request not found" });
      }

      if (record.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view this request" });
      }

      res.json(record);
    } catch (error) {
      console.error("Error fetching loan request:", error);
      res.status(500).json({ error: "Failed to fetch loan request" });
    }
  });

  // POST /api/loans - Submit a new loan request
  app.post("/api/loans", async (req, res) => {
    try {
      if (!req.user) {
        console.error("[LOAN] Unauthorized access attempt");
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const parseResult = insertLoanRequestSchema.safeParse({
        ...req.body,
        userId,
      });

      if (!parseResult.success) {
        console.error("[LOAN] Validation failed:", parseResult.error.errors);
        return res.status(400).json({
          error: "Invalid request data",
          details: parseResult.error.errors,
        });
      }

      console.log(`[LOAN] Creating request for user:`, userId);
      const record = await loanRepository.create(parseResult.data);
      console.log(`[LOAN] Created successfully:`, record.id);
      res.status(201).json(record);
    } catch (error) {
      console.error("[LOAN] Error creating loan request:", error);
      res.status(500).json({ error: "Failed to create loan request" });
    }
  });

  // POST /api/admin/loans - Admin submits loan on behalf of any user
  app.post("/api/admin/loans", async (req, res) => {
    try {
      if (!req.user) {
        console.error("[LOAN_ADMIN] Unauthorized access attempt");
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check if user has admin permissions
      const userRole = req.user.roleId?.toLowerCase();
      const isAdmin = ["admin", "super_hod", "hod", "manager", "assistant_manager"].includes(userRole);

      if (!isAdmin) {
        console.error("[LOAN_ADMIN] Non-admin user attempted access:", req.user.userId, userRole);
        return res.status(403).json({ error: "Admin access required" });
      }

      // Validate the request with userId from request body
      const parseResult = insertLoanRequestAdminSchema.safeParse(req.body);

      if (!parseResult.success) {
        console.error("[LOAN_ADMIN] Validation failed:", parseResult.error.errors);
        return res.status(400).json({
          error: "Invalid request data",
          details: parseResult.error.errors,
        });
      }

      // Verify the target user exists
      const targetUser = await db.select().from(users).where(eq(users.id, parseResult.data.userId)).limit(1);
      if (!targetUser[0]) {
        console.error("[LOAN_ADMIN] Employee not found:", parseResult.data.userId);
        return res.status(404).json({ error: "Employee not found" });
      }

      console.log(`[LOAN_ADMIN] Creating loan for user: ${parseResult.data.userId} by admin: ${req.user.userId}`);
      const record = await loanRepository.create(parseResult.data);
      console.log(`[LOAN_ADMIN] Created successfully:`, record.id);
      res.status(201).json(record);
    } catch (error) {
      console.error("[LOAN_ADMIN] Error creating loan request:", error);
      res.status(500).json({ error: "Failed to create loan request" });
    }
  });

  // DELETE /api/loans/:id - Delete a pending loan request
  app.delete("/api/loans/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const record = await loanRepository.cancel(req.params.id, userId);

      if (!record) {
        return res.status(400).json({
          error: "Cannot delete this request. It may not exist, not belong to you, or is no longer pending."
        });
      }

      res.json({ message: "Loan request deleted successfully" });
    } catch (error) {
      console.error("Error deleting loan request:", error);
      res.status(500).json({ error: "Failed to delete loan request" });
    }
  });

  // PATCH /api/loans/:id/manager-approve - Manager approves a loan request
  app.patch("/api/loans/:id/manager-approve", requireActionPermission("loan.managerApprove", { allowRole: isManagerialRole, message: "You are not authorized to approve loan requests." }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      // Only managerial roles may perform manager-level approval.
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to approve loan requests." });
      }
      // Segregation of duties: a non-admin may not approve their own request.
      const existingLoan = await loanRepository.findById(req.params.id);
      if (
        existingLoan &&
        existingLoan.userId === userId &&
        normalizeRole(callerRole(req)) !== ROLES.ADMIN
      ) {
        return res.status(403).json({ error: "You cannot approve your own loan request." });
      }
      const record = await loanRepository.managerApprove(req.params.id, userId);

      if (!record) {
        return res.status(400).json({
          error: "Cannot approve this request. It may not exist or is not in pending state."
        });
      }

      await ActivityLogService.log({
        userId,
        action: "LOAN_MANAGER_APPROVED",
        resourceType: "loan_request",
        resourceId: req.params.id,
        details: `Manager-approved by role ${normalizeRole(callerRole(req))}`,
      });

      res.json(record);
    } catch (error) {
      console.error("Error approving loan request (manager):", error);
      res.status(500).json({ error: "Failed to approve loan request" });
    }
  });

  // PATCH /api/loans/:id/hod-approve - HOD approves a loan request
  app.patch("/api/loans/:id/hod-approve", requireActionPermission("loan.hodApprove", { allowRole: isHodAllowed, message: "You are not authorized to perform HOD approval." }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      // HOD-level approval is limited to HOD/super_hod/admin (and sales_manager per role model).
      if (!isHodAllowed(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to perform HOD approval." });
      }
      // Segregation of duties: a non-admin may not approve their own request.
      const existingLoanHod = await loanRepository.findById(req.params.id);
      if (
        existingLoanHod &&
        existingLoanHod.userId === userId &&
        normalizeRole(callerRole(req)) !== ROLES.ADMIN
      ) {
        return res.status(403).json({ error: "You cannot approve your own loan request." });
      }
      const record = await loanRepository.hodApprove(req.params.id, userId);

      if (!record) {
        return res.status(400).json({
          error: "Cannot approve this request. It may not exist or is not in manager-approved state."
        });
      }

      await ActivityLogService.log({
        userId,
        action: "LOAN_HOD_APPROVED",
        resourceType: "loan_request",
        resourceId: req.params.id,
        details: `HOD-approved by role ${normalizeRole(callerRole(req))}`,
      });

      res.json(record);
    } catch (error) {
      console.error("Error approving loan request (HOD):", error);
      res.status(500).json({ error: "Failed to approve loan request" });
    }
  });

  // PATCH /api/loans/:id/reject - Reject a loan request
  app.patch("/api/loans/:id/reject", requireActionPermission("loan.reject", { allowRole: isManagerialRole, message: "You are not authorized to reject loan requests." }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const { reason } = req.body;

      // Only managerial roles may reject loan requests.
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to reject loan requests." });
      }
      // Segregation of duties: a non-admin may not reject their own request.
      const existingLoanR = await loanRepository.findById(req.params.id);
      if (
        existingLoanR &&
        existingLoanR.userId === userId &&
        normalizeRole(callerRole(req)) !== ROLES.ADMIN
      ) {
        return res.status(403).json({ error: "You cannot reject your own loan request." });
      }
      const record = await loanRepository.reject(req.params.id, userId, reason);

      if (!record) {
        return res.status(400).json({
          error: "Cannot reject this request. It may not exist or is already processed."
        });
      }

      await ActivityLogService.log({
        userId,
        action: "LOAN_REJECTED",
        resourceType: "loan_request",
        resourceId: req.params.id,
        details: `Rejected by role ${normalizeRole(callerRole(req))}`,
      });

      res.json(record);
    } catch (error) {
      console.error("Error rejecting loan request:", error);
      res.status(500).json({ error: "Failed to reject loan request" });
    }
  });

  // PATCH /api/loans/:id/complete - Mark loan as completed
  app.patch("/api/loans/:id/complete", requireActionPermission("loan.complete", { allowRole: isManagerialRole, message: "You are not authorized to complete loans." }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Marking a loan complete is a managerial/accounts action.
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to complete loans." });
      }
      const record = await loanRepository.markAsCompleted(req.params.id);

      if (!record) {
        return res.status(400).json({
          error: "Cannot complete this loan. It may not exist or is not fully approved."
        });
      }

      res.json(record);
    } catch (error) {
      console.error("Error completing loan:", error);
      res.status(500).json({ error: "Failed to complete loan" });
    }
  });

  // PATCH /api/loans/:id/pay-installment - Record an installment payment
  app.patch("/api/loans/:id/pay-installment", requireActionPermission("loan.payInstallment", { allowRole: isManagerialRole, message: "You are not authorized to record loan payments." }), async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Recording installment payments is a managerial/accounts action.
      if (!isManagerialRole(callerRole(req))) {
        return res.status(403).json({ error: "You are not authorized to record loan payments." });
      }

      const { amount } = req.body;
      if (!amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ error: "Valid payment amount is required" });
      }

      const loan = await loanRepository.findById(req.params.id);
      if (!loan) {
        return res.status(404).json({ error: "Loan not found" });
      }

      if (loan.status !== "HODApproved") {
        return res.status(400).json({ error: "Loan is not active" });
      }

      const currentRemaining = parseFloat(loan.remainingAmount as string) || 0;
      const paymentAmount = parseFloat(amount);
      const newRemaining = currentRemaining - paymentAmount;

      const record = await loanRepository.updateRemainingAmount(req.params.id, newRemaining);

      if (!record) {
        return res.status(400).json({ error: "Failed to update loan" });
      }

      res.json(record);
    } catch (error) {
      console.error("Error recording installment payment:", error);
      res.status(500).json({ error: "Failed to record installment payment" });
    }
  });
}
