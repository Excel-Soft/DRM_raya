import type { Express } from "express";
import { loanRepository } from "./repositories/loan.repository";
import { insertLoanRequestSchema, insertLoanRequestAdminSchema } from "@shared/schema";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

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
  app.patch("/api/loans/:id/manager-approve", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      // TODO: Add role check for manager
      const record = await loanRepository.managerApprove(req.params.id, userId);

      if (!record) {
        return res.status(400).json({
          error: "Cannot approve this request. It may not exist or is not in pending state."
        });
      }

      res.json(record);
    } catch (error) {
      console.error("Error approving loan request (manager):", error);
      res.status(500).json({ error: "Failed to approve loan request" });
    }
  });

  // PATCH /api/loans/:id/hod-approve - HOD approves a loan request
  app.patch("/api/loans/:id/hod-approve", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      // TODO: Add role check for HOD
      const record = await loanRepository.hodApprove(req.params.id, userId);

      if (!record) {
        return res.status(400).json({
          error: "Cannot approve this request. It may not exist or is not in manager-approved state."
        });
      }

      res.json(record);
    } catch (error) {
      console.error("Error approving loan request (HOD):", error);
      res.status(500).json({ error: "Failed to approve loan request" });
    }
  });

  // PATCH /api/loans/:id/reject - Reject a loan request
  app.patch("/api/loans/:id/reject", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userId = req.user.userId;
      const { reason } = req.body;

      // TODO: Add role check for manager/HOD
      const record = await loanRepository.reject(req.params.id, userId, reason);

      if (!record) {
        return res.status(400).json({
          error: "Cannot reject this request. It may not exist or is already processed."
        });
      }

      res.json(record);
    } catch (error) {
      console.error("Error rejecting loan request:", error);
      res.status(500).json({ error: "Failed to reject loan request" });
    }
  });

  // PATCH /api/loans/:id/complete - Mark loan as completed
  app.patch("/api/loans/:id/complete", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // TODO: Add role check for admin/accounts
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
  app.patch("/api/loans/:id/pay-installment", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
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
