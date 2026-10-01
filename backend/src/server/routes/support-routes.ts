import type { Express } from "express";
import { authMiddleware, requireRole } from "../middleware/auth.middleware";
import { ticketsRepository } from "../repositories/tickets.repository";
import { supportMessagesRepository } from "../repositories/support-messages.repository";
import { channelConfigRepository } from "../repositories/channel-config.repository";
import {
  insertSupportTicketSchema,
  insertSupportChannelConfigSchema
} from "@shared/schema";
import { z } from "zod";

export function registerSupportRoutes(app: Express) {
  // NOTE: Patch 4 Stage 6 (ISS-02 P2) mounts a Support module deactivation gate
  // in `server/routes.ts` (before global auth) that returns 404 for the entire
  // `/api/support/*` surface when `SUPPORT_MODULE_ENABLED` is not "true". The
  // handlers below only run when the module is enabled.

  // Auth is enforced globally in `server/routes.ts` (or via MOCK_AUTH when enabled).
  app.use("/api/support", authMiddleware);

  // ===== MY-ASSIGNMENT ENDPOINTS (any authenticated role) =====
  // A ticket can be assigned to any staff member regardless of role (the
  // "Person" picker in Add Ticket searches all users), so the sticky
  // assignment popup + accept/reject actions must work for every role too —
  // registered BEFORE the requireRole gate below (which is scoped to the
  // ticket-management roles only) so they're not blocked by it. Each handler
  // is ownership-scoped (assignedToUserId = the caller) at the repository
  // layer, so this is safe to leave open to any authenticated user.

  // GET /api/support/tickets/my-assignments/pending - tickets assigned to me
  // that I haven't accepted/rejected yet (drives the sticky popup).
  app.get("/api/support/tickets/my-assignments/pending", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).userId || (req.user as any).id;
      const tickets = await ticketsRepository.findPendingAssignmentsForUser(userId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching pending assignments:", error);
      res.status(500).json({ error: "Failed to fetch pending assignments" });
    }
  });

  // GET /api/support/tickets/my-assignments/accepted - tickets assigned to
  // me that I've accepted (drives the "Complaint Box" widget).
  app.get("/api/support/tickets/my-assignments/accepted", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).userId || (req.user as any).id;
      const tickets = await ticketsRepository.findAcceptedForUser(userId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching accepted assignments:", error);
      res.status(500).json({ error: "Failed to fetch accepted assignments" });
    }
  });

  // POST /api/support/tickets/:id/accept - I accept my own pending assignment
  app.post("/api/support/tickets/:id/accept", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).userId || (req.user as any).id;
      const updated = await ticketsRepository.acceptAssignment(req.params.id, userId);
      if (!updated) return res.status(404).json({ error: "Ticket not found or not assigned to you" });
      res.json(updated);
    } catch (error) {
      console.error("Error accepting assignment:", error);
      res.status(500).json({ error: "Failed to accept assignment" });
    }
  });

  // POST /api/support/tickets/:id/reject - I reject my own pending assignment.
  // An optional `reason` is saved as a real message on the ticket thread so
  // the complaint manager can see why it was rejected when they open it.
  app.post("/api/support/tickets/:id/reject", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).userId || (req.user as any).id;
      const updated = await ticketsRepository.rejectAssignment(req.params.id, userId);
      if (!updated) return res.status(404).json({ error: "Ticket not found or not assigned to you" });

      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (reason) {
        await supportMessagesRepository.create({
          ticketId: req.params.id,
          senderUserId: userId,
          message: `[Rejected assignment] ${reason}`,
        });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error rejecting assignment:", error);
      res.status(500).json({ error: "Failed to reject assignment" });
    }
  });

  // POST /api/support/tickets/:id/submit - I mark my accepted ticket done
  // (InProgress -> Resolved), e.g. from the Complaint Box widget.
  app.post("/api/support/tickets/:id/submit", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).userId || (req.user as any).id;
      const updated = await ticketsRepository.submitForReview(req.params.id, userId);
      if (!updated) return res.status(404).json({ error: "Ticket not found or not assigned to you" });
      res.json(updated);
    } catch (error) {
      console.error("Error submitting ticket:", error);
      res.status(500).json({ error: "Failed to submit ticket" });
    }
  });

  // GET /api/support/tickets/my-submissions/pending-review - tickets I
  // created that the assignee has submitted, awaiting my approval (drives
  // the sticky approval popup for the complaint manager).
  app.get("/api/support/tickets/my-submissions/pending-review", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).userId || (req.user as any).id;
      const tickets = await ticketsRepository.findPendingReviewForCreator(userId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching pending reviews:", error);
      res.status(500).json({ error: "Failed to fetch pending reviews" });
    }
  });

  // POST /api/support/tickets/:id/approve - I (the creator) approve a
  // submitted ticket.
  app.post("/api/support/tickets/:id/approve", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = (req.user as any).userId || (req.user as any).id;
      const updated = await ticketsRepository.approveReview(req.params.id, userId);
      if (!updated) return res.status(404).json({ error: "Ticket not found or not created by you" });
      res.json(updated);
    } catch (error) {
      console.error("Error approving ticket:", error);
      res.status(500).json({ error: "Failed to approve ticket" });
    }
  });

  // Phase 11 — restrict to the roles the seeded permission row
  // ("Support Module API", server/seed-settings.ts) already implies; before
  // this, any authenticated user of any role could call these endpoints
  // once the module flag was enabled.
  app.use("/api/support", requireRole("sales_executive", "assistant_manager", "manager", "hod", "admin", "complaint_manager"));

  // ===== TICKET ENDPOINTS =====

  // GET /api/support/tickets - List tickets with filters
  app.get("/api/support/tickets", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { status, channel, priority, customerId, assignedToUserId } = req.query;

      const tickets = await ticketsRepository.findAll({
        status: status as string | undefined,
        channel: channel as string | undefined,
        priority: priority as string | undefined,
        customerId: customerId as string | undefined,
        assignedToUserId: assignedToUserId as string | undefined,
      });

      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  // GET /api/support/tickets/:id - Get single ticket with details
  app.get("/api/support/tickets/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const ticket = await ticketsRepository.findById(req.params.id);

      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      res.json(ticket);
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  // POST /api/support/tickets - Create ticket
  app.post("/api/support/tickets", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // createdBy is server-derived from the authenticated caller, never
      // trusted from the request body (Phase 11 — created_by is NOT NULL
      // at the DB layer; also closes a client-spoofing gap).
      const validated = insertSupportTicketSchema.omit({ createdBy: true }).parse(req.body);
      const createdBy = (req.user as any).userId || (req.user as any).id;

      const ticket = await ticketsRepository.create({ ...validated, createdBy });

      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating ticket:", error);
      res.status(500).json({ error: "Failed to create ticket" });
    }
  });

  // PUT /api/support/tickets/:id - Update ticket
  app.put("/api/support/tickets/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check if ticket exists
      const existing = await ticketsRepository.findById(req.params.id);

      if (!existing) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      // Validate and update
      const validated = insertSupportTicketSchema.partial().parse(req.body);
      const updated = await ticketsRepository.update(req.params.id, validated);

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating ticket:", error);
      res.status(500).json({ error: "Failed to update ticket" });
    }
  });

  // DELETE /api/support/tickets/:id - Delete ticket
  app.delete("/api/support/tickets/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const success = await ticketsRepository.delete(req.params.id);

      if (!success) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting ticket:", error);
      res.status(500).json({ error: "Failed to delete ticket" });
    }
  });

  // POST /api/support/tickets/:id/assign - Assign ticket to user
  app.post("/api/support/tickets/:id/assign", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const updated = await ticketsRepository.assignTicket(req.params.id, userId);

      if (!updated) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error assigning ticket:", error);
      res.status(500).json({ error: "Failed to assign ticket" });
    }
  });

  // POST /api/support/tickets/:id/status - Update ticket status
  app.post("/api/support/tickets/:id/status", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ error: "status is required" });
      }

      const updated = await ticketsRepository.updateStatus(req.params.id, status);

      if (!updated) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error updating ticket status:", error);
      res.status(500).json({ error: "Failed to update ticket status" });
    }
  });

  // POST /api/support/tickets/:id/mark-sent - Mark ticket data as sent
  app.post("/api/support/tickets/:id/mark-sent", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const updated = await ticketsRepository.markDataSent(req.params.id);

      if (!updated) {
        return res.status(404).json({ error: "Ticket not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error marking ticket as sent:", error);
      res.status(500).json({ error: "Failed to mark ticket as sent" });
    }
  });

  // ===== MESSAGE ENDPOINTS =====

  // GET /api/support/tickets/:ticketId/messages - List messages for ticket
  app.get("/api/support/tickets/:ticketId/messages", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const messages = await supportMessagesRepository.findByTicketId(req.params.ticketId);

      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // POST /api/support/messages - Create message
  // (Not insertSupportMessageSchema/Drizzle's supportMessages shape — the live
  // table drifted from that definition; see support-messages.repository.ts.)
  app.post("/api/support/messages", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const ticketId = String(req.body?.ticketId ?? "").trim();
      const message = String(req.body?.message ?? req.body?.body ?? "").trim();
      if (!ticketId || !message) {
        return res.status(400).json({ error: "Validation failed", details: "ticketId and message are required" });
      }
      const userId = (req.user as any).userId || (req.user as any).id;

      const created = await supportMessagesRepository.create({ ticketId, senderUserId: userId, message });

      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  // DELETE /api/support/messages/:id - Delete message
  app.delete("/api/support/messages/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const success = await supportMessagesRepository.delete(req.params.id);

      if (!success) {
        return res.status(404).json({ error: "Message not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  // ===== CHANNEL CONFIG ENDPOINTS =====

  // GET /api/support/channels - List all channel configs
  app.get("/api/support/channels", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const configs = await channelConfigRepository.findAll();

      res.json(configs);
    } catch (error) {
      console.error("Error fetching channel configs:", error);
      res.status(500).json({ error: "Failed to fetch channel configs" });
    }
  });

  // GET /api/support/channels/:id - Get single channel config
  app.get("/api/support/channels/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const config = await channelConfigRepository.findById(req.params.id);

      if (!config) {
        return res.status(404).json({ error: "Channel config not found" });
      }

      res.json(config);
    } catch (error) {
      console.error("Error fetching channel config:", error);
      res.status(500).json({ error: "Failed to fetch channel config" });
    }
  });

  // POST /api/support/channels - Create channel config
  app.post("/api/support/channels", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate request body
      const validated = insertSupportChannelConfigSchema.parse(req.body);

      const config = await channelConfigRepository.create(validated);

      res.status(201).json(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error creating channel config:", error);
      res.status(500).json({ error: "Failed to create channel config" });
    }
  });

  // PUT /api/support/channels/:id - Update channel config
  app.put("/api/support/channels/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check if config exists
      const existing = await channelConfigRepository.findById(req.params.id);

      if (!existing) {
        return res.status(404).json({ error: "Channel config not found" });
      }

      // Validate and update
      const validated = insertSupportChannelConfigSchema.partial().parse(req.body);
      const updated = await channelConfigRepository.update(req.params.id, validated);

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("Error updating channel config:", error);
      res.status(500).json({ error: "Failed to update channel config" });
    }
  });

  // DELETE /api/support/channels/:id - Delete channel config
  app.delete("/api/support/channels/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const success = await channelConfigRepository.delete(req.params.id);

      if (!success) {
        return res.status(404).json({ error: "Channel config not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting channel config:", error);
      res.status(500).json({ error: "Failed to delete channel config" });
    }
  });

  // POST /api/support/channels/:id/toggle - Toggle channel active status
  app.post("/api/support/channels/:id/toggle", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { isActive } = req.body;

      if (isActive === undefined) {
        return res.status(400).json({ error: "isActive is required" });
      }

      const updated = await channelConfigRepository.toggleActive(req.params.id, isActive);

      if (!updated) {
        return res.status(404).json({ error: "Channel config not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error toggling channel:", error);
      res.status(500).json({ error: "Failed to toggle channel" });
    }
  });

  // ===== QUEUE PROCESSING ENDPOINT =====

  // GET /api/support/queue - Process next ticket in queue (Open tickets without assignment)
  app.get("/api/support/queue", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Get all Open tickets without assignment
      const tickets = await ticketsRepository.findAll({
        status: "Open",
      });

      // Filter for unassigned tickets
      const unassignedTickets = tickets.filter(t => !t.assignedToUserId);

      // Return the oldest unassigned ticket (FIFO queue)
      const nextTicket = unassignedTickets.length > 0 ? unassignedTickets[unassignedTickets.length - 1] : null;

      res.json({
        queueLength: unassignedTickets.length,
        nextTicket,
      });
    } catch (error) {
      console.error("Error processing queue:", error);
      res.status(500).json({ error: "Failed to process queue" });
    }
  });
}
