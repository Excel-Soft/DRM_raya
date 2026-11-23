import { Request, Response, Router } from "express";
import { requireRole } from "../middleware/auth.middleware";
import { ticketsRepository } from "../repositories/tickets.repository";
import { supportMessagesRepository } from "../repositories/support-messages.repository";
import { insertSupportTicketSchema } from "@shared/schema";
import { z } from "zod";
import {
  fetchComplaintManagerStats,
  fetchComplaintManagerTickets,
} from "../services/complaint-manager-dashboard.service";

const router = Router();

const COMPLAINT_MANAGER_ROLES = [
  "complaint_manager",
  "manager",
  "hod",
  "super_hod",
  "admin",
] as const;

router.use(requireRole(...COMPLAINT_MANAGER_ROLES));

router.get("/tickets", async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "LD";
    const [data, stats] = await Promise.all([
      fetchComplaintManagerTickets(),
      fetchComplaintManagerStats(period),
    ]);
    res.json({ data, stats });
  } catch (error: any) {
    console.error("Error fetching complaint manager tickets:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.get("/tickets/:id/messages", async (req: Request, res: Response) => {
  try {
    const messages = await supportMessagesRepository.findByTicketId(req.params.id);
    const mapped = messages.map((m) => ({
      id: m.id,
      senderName: m.senderName ?? (m.senderUserId ? null : "Customer"),
      message: m.message,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
    }));
    res.json(mapped);
  } catch (error: any) {
    console.error("Error fetching ticket messages:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.post("/tickets", async (req: Request, res: Response) => {
  try {
    const validated = insertSupportTicketSchema.omit({ createdBy: true }).parse(req.body);
    const createdBy = (req as any).user?.userId || (req as any).user?.id;
    const ticket = await ticketsRepository.create({ ...validated, createdBy });
    res.status(201).json(ticket);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating complaint ticket:", error);
    res.status(500).json({ error: error.message || "Failed to create ticket" });
  }
});

router.post("/tickets/:id/status", async (req: Request, res: Response) => {
  try {
    const status = req.body?.status;
    if (!status) return res.status(400).json({ error: "status is required" });
    const updated = await ticketsRepository.updateStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: "Ticket not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error updating ticket status:", error);
    res.status(500).json({ error: error.message || "Failed to update status" });
  }
});

router.post("/tickets/:id/assign", async (req: Request, res: Response) => {
  try {
    const userId = req.body?.userId;
    if (!userId) return res.status(400).json({ error: "userId is required" });
    const updated = await ticketsRepository.assignTicket(req.params.id, userId);
    if (!updated) return res.status(404).json({ error: "Ticket not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("Error assigning ticket:", error);
    res.status(500).json({ error: error.message || "Failed to assign ticket" });
  }
});

router.post("/messages", async (req: Request, res: Response) => {
  try {
    const ticketId = req.body?.ticketId;
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!ticketId || !message) {
      return res.status(400).json({ error: "ticketId and message are required" });
    }
    const senderUserId = (req as any).user?.userId || (req as any).user?.id;
    const created = await supportMessagesRepository.create({
      ticketId,
      senderUserId,
      message,
    });
    res.status(201).json(created);
  } catch (error: any) {
    console.error("Error creating ticket message:", error);
    res.status(500).json({ error: error.message || "Failed to add message" });
  }
});

export default router;