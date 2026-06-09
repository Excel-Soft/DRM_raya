import { Router, type Request, type Response } from "express";
import { ValidationService } from "../services/validation.service";
import { sendError } from "../utils/api-error";
import { CommunicationService } from "../services/communication.service";
import { isManagerialRole } from "../utils/role-utils";
import {
  createCommunicationSchema,
  patchCommunicationSchema,
  completeNextActionSchema,
  listCommunicationsSchema,
  COMMUNICATION_ENTITY_TYPES,
} from "../validators/communication.validators";

/**
 * Stage 7 — communication / follow-up timeline + reminder endpoints.
 * Mounted under /api/communications behind the global auth middleware, so every
 * route already has an authenticated `req.user`.
 */
export const communicationRouter = Router();

function actorOf(req: Request) {
  const u = req.user as any;
  return {
    userId: u?.userId ?? u?.id,
    roleId: u?.roleId,
    roles: u?.roles,
  };
}

// Managers/executives may view any user's reminders; everyone else is scoped to
// their own (mirrors the owner/manager scoping used across sales/service routes).
function isManager(req: Request): boolean {
  const u = req.user as any;
  return isManagerialRole(u?.activeRoleId || u?.roleId || u?.role);
}

// GET /api/communications — list with filters
communicationRouter.get("/", async (req: Request, res: Response) => {
  try {
    const filters = ValidationService.query(listCommunicationsSchema, req);
    // Non-managers can only list their own communications (no arbitrary userId).
    if (!isManager(req)) {
      filters.userId = actorOf(req).userId;
    }
    const rows = await CommunicationService.list(filters);
    res.json({ success: true, data: rows });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/communications/reminders/due — upcoming follow-ups (optionally ?mine=true)
communicationRouter.get("/reminders/due", async (req: Request, res: Response) => {
  try {
    const self = actorOf(req).userId;
    // Non-managers are always scoped to their own reminders.
    const userId = isManager(req)
      ? (req.query.mine === "true" ? self : (req.query.userId as string | undefined))
      : self;
    const rows = await CommunicationService.remindersDue(userId);
    res.json({ success: true, data: rows });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/communications/reminders/overdue — past-due follow-ups
communicationRouter.get("/reminders/overdue", async (req: Request, res: Response) => {
  try {
    const self = actorOf(req).userId;
    // Non-managers are always scoped to their own reminders.
    const userId = isManager(req)
      ? (req.query.mine === "true" ? self : (req.query.userId as string | undefined))
      : self;
    const rows = await CommunicationService.remindersOverdue(userId);
    res.json({ success: true, data: rows });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/communications/:entityType/:entityId/timeline
communicationRouter.get(
  "/:entityType/:entityId/timeline",
  async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      if (!(COMMUNICATION_ENTITY_TYPES as readonly string[]).includes(entityType)) {
        return res
          .status(400)
          .json({ success: false, error: { code: "INVALID_ENTITY_TYPE", message: "Unknown entity type" } });
      }
      const rows = await CommunicationService.timeline(entityType, entityId);
      res.json({ success: true, data: rows });
    } catch (err) {
      sendError(res, err);
    }
  },
);

// POST /api/communications — create a communication log
communicationRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = ValidationService.parse(createCommunicationSchema, req.body);
    const row = await CommunicationService.create(body, actorOf(req), req);
    res.status(201).json({ success: true, data: row });
  } catch (err) {
    sendError(res, err);
  }
});

// PATCH /api/communications/:id — update notes / reschedule / status
communicationRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const body = ValidationService.parse(patchCommunicationSchema, req.body);
    const row = await CommunicationService.patch(req.params.id, body, actorOf(req), req);
    res.json({ success: true, data: row });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/communications/:id/complete-next-action
communicationRouter.post("/:id/complete-next-action", async (req: Request, res: Response) => {
  try {
    const body = ValidationService.parse(completeNextActionSchema, req.body);
    const result = await CommunicationService.completeNextAction(
      req.params.id,
      body,
      actorOf(req),
      req,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

export default communicationRouter;
