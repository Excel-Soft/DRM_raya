/**
 * WebExcels DRM Copilot V1 routes — mounted under /api/copilot.
 *
 * MUST be registered AFTER authMiddleware (server/routes.ts) so every handler
 * below runs with a verified req.user. Every handler additionally re-checks
 * req.user, the Copilot allowlist, and runtime availability — a bearer token
 * alone is necessary but not sufficient to use Copilot.
 */
import type { Express, Request, Response } from "express";
import { loadCopilotConfig, getCopilotAvailability, isUserAllowed } from "../services/copilot/config";
import { resolveCopilotIdentity } from "../services/copilot/identity";
import { runTurn, CopilotBlockedError } from "../services/copilot/copilot.service";
import {
  createConversation,
  listConversationsForUser,
  getConversationForUser,
  listMessages,
  listDraftsForUser,
  getDraftForUser,
  discardDraft,
  listAuditForUser,
} from "../services/copilot/persistence";
import { proposeFollowupAction, confirmFollowupAction, ProposalInvalidError } from "../services/copilot/followup-action";
import { ApiError } from "../utils/api-error";
import { ProviderError } from "../services/copilot/provider/provider.interface";

function requireCopilotAccess(req: Request, res: Response): { cfg: ReturnType<typeof loadCopilotConfig> } | null {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const cfg = loadCopilotConfig();
  const availability = getCopilotAvailability(cfg);
  if (!availability.configured) {
    res.status(503).json({ error: "CopilotUnavailable", reasons: availability.reasons });
    return null;
  }
  const userId = String((req.user as any).userId);
  if (!isUserAllowed(cfg, userId)) {
    res.status(403).json({ error: "Forbidden", message: "You are not on the Copilot pilot allowlist." });
    return null;
  }
  return { cfg };
}

export function registerCopilotRoutes(app: Express) {
  // GET /api/copilot/capability — what's actually configured/available, no secrets.
  app.get("/api/copilot/capability", async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const cfg = loadCopilotConfig();
    const availability = getCopilotAvailability(cfg);
    const userId = String((req.user as any).userId);
    res.json({
      provider: cfg.provider,
      configured: availability.configured,
      reasons: availability.configured ? [] : availability.reasons,
      allowedForUser: availability.configured && isUserAllowed(cfg, userId),
      followupCreateEnabled: cfg.allowFollowupCreate,
      limits: {
        maxToolRounds: cfg.maxToolRounds,
        maxOutputTokens: cfg.maxOutputTokens,
        rateLimitPerMinute: cfg.rateLimitPerMinute,
        maxMessageCharacters: cfg.maxMessageCharacters,
      },
    });
  });

  // POST /api/copilot/conversations — start a new conversation (optional; /ask also auto-creates).
  app.post("/api/copilot/conversations", async (req: Request, res: Response) => {
    const access = requireCopilotAccess(req, res);
    if (!access) return;
    try {
      const identity = await resolveCopilotIdentity(req);
      if (!identity) return res.status(401).json({ error: "Unauthorized" });
      const conversation = await createConversation(identity.userId, null);
      res.status(201).json({ conversation });
    } catch (err) {
      console.error("[copilot] create conversation error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create conversation" });
    }
  });

  // GET /api/copilot/conversations — list the current user's own conversations.
  app.get("/api/copilot/conversations", async (req: Request, res: Response) => {
    const access = requireCopilotAccess(req, res);
    if (!access) return;
    try {
      const identity = await resolveCopilotIdentity(req);
      if (!identity) return res.status(401).json({ error: "Unauthorized" });
      const conversations = await listConversationsForUser(identity.userId);
      res.json({ conversations });
    } catch (err) {
      console.error("[copilot] list conversations error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to list conversations" });
    }
  });

  // GET /api/copilot/conversations/:id/messages
  app.get("/api/copilot/conversations/:id/messages", async (req: Request, res: Response) => {
    const access = requireCopilotAccess(req, res);
    if (!access) return;
    try {
      const identity = await resolveCopilotIdentity(req);
      if (!identity) return res.status(401).json({ error: "Unauthorized" });
      const conversation = await getConversationForUser(String(req.params.id), identity.userId);
      if (!conversation) return res.status(404).json({ error: "NotFound", message: "Conversation not found" });
      const messages = await listMessages(conversation.id, 100);
      res.json({ messages });
    } catch (err) {
      console.error("[copilot] list messages error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch messages" });
    }
  });

  // POST /api/copilot/ask — the main turn endpoint.
  app.post("/api/copilot/ask", async (req: Request, res: Response) => {
    const access = requireCopilotAccess(req, res);
    if (!access) return;
    try {
      const identity = await resolveCopilotIdentity(req);
      if (!identity) return res.status(401).json({ error: "Unauthorized" });
      const body = req.body ?? {};
      const message = typeof body.message === "string" ? body.message : "";
      const conversationId = body.conversationId ? String(body.conversationId) : null;

      const result = await runTurn({ cfg: access.cfg, identity, conversationId, message });
      res.json(result);
    } catch (err) {
      if (err instanceof CopilotBlockedError) {
        return res.status(409).json({ error: "Blocked", code: err.code, message: err.message });
      }
      if (err instanceof ProviderError) {
        const statusByKind: Record<string, number> = {
          auth: 502,
          rate_limit: 429,
          timeout: 504,
          model_unavailable: 503,
          invalid_request: 502,
          unknown: 502,
        };
        return res.status(statusByKind[err.kind] ?? 502).json({ error: "ProviderError", kind: err.kind, message: err.message });
      }
      console.error("[copilot] ask error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to process your message" });
    }
  });

  // ─── Drafts ─────────────────────────────────────────────────────────────
  app.get("/api/copilot/drafts", async (req: Request, res: Response) => {
    const access = requireCopilotAccess(req, res);
    if (!access) return;
    try {
      const identity = await resolveCopilotIdentity(req);
      if (!identity) return res.status(401).json({ error: "Unauthorized" });
      const drafts = await listDraftsForUser(identity.userId);
      res.json({ drafts });
    } catch (err) {
      console.error("[copilot] list drafts error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to list drafts" });
    }
  });

  app.delete("/api/copilot/drafts/:id", async (req: Request, res: Response) => {
    const access = requireCopilotAccess(req, res);
    if (!access) return;
    try {
      const identity = await resolveCopilotIdentity(req);
      if (!identity) return res.status(401).json({ error: "Unauthorized" });
      const draft = await getDraftForUser(String(req.params.id), identity.userId);
      if (!draft) return res.status(404).json({ error: "NotFound", message: "Draft not found" });
      await discardDraft(draft.id, identity.userId);
      res.json({ success: true });
    } catch (err) {
      console.error("[copilot] discard draft error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to discard draft" });
    }
  });

  // ─── Activity (audit) ───────────────────────────────────────────────────
  app.get("/api/copilot/activity", async (req: Request, res: Response) => {
    const access = requireCopilotAccess(req, res);
    if (!access) return;
    try {
      const identity = await resolveCopilotIdentity(req);
      if (!identity) return res.status(401).json({ error: "Unauthorized" });
      const entries = await listAuditForUser(identity.userId);
      res.json({ entries });
    } catch (err) {
      console.error("[copilot] list activity error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to list activity" });
    }
  });

  // ─── Optional write: confirmed self-follow-up (M4) ─────────────────────
  app.post("/api/copilot/actions/followup/propose", async (req: Request, res: Response) => {
    const access = requireCopilotAccess(req, res);
    if (!access) return;
    if (!access.cfg.allowFollowupCreate) {
      return res.status(403).json({ error: "Forbidden", message: "Follow-up creation is disabled on this server." });
    }
    try {
      const identity = await resolveCopilotIdentity(req);
      if (!identity) return res.status(401).json({ error: "Unauthorized" });
      const body = req.body ?? {};
      const conversationId = String(body.conversationId ?? "");
      const conversation = conversationId ? await getConversationForUser(conversationId, identity.userId) : null;
      if (!conversation) return res.status(404).json({ error: "NotFound", message: "Conversation not found" });

      const proposal = await proposeFollowupAction({
        req,
        conversationId: conversation.id,
        userId: identity.userId,
        payload: {
          customerId: String(body.customerId ?? ""),
          note: String(body.note ?? "").slice(0, 2000),
          method: String(body.method ?? "Call"),
          dueAt: String(body.dueAt ?? new Date().toISOString()),
        },
      });
      res.status(201).json({ proposal });
    } catch (err) {
      if (err instanceof ApiError) return res.status(err.status).json({ error: err.code, message: err.message });
      console.error("[copilot] propose followup error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to prepare follow-up proposal" });
    }
  });

  app.post("/api/copilot/actions/followup/confirm", async (req: Request, res: Response) => {
    const access = requireCopilotAccess(req, res);
    if (!access) return;
    if (!access.cfg.allowFollowupCreate) {
      return res.status(403).json({ error: "Forbidden", message: "Follow-up creation is disabled on this server." });
    }
    try {
      const identity = await resolveCopilotIdentity(req);
      if (!identity) return res.status(401).json({ error: "Unauthorized" });
      const body = req.body ?? {};
      const execution = await confirmFollowupAction({
        req,
        userId: identity.userId,
        proposalId: String(body.proposalId ?? ""),
        payloadHash: String(body.payloadHash ?? ""),
      });
      res.json({ execution });
    } catch (err) {
      if (err instanceof ProposalInvalidError) {
        return res.status(409).json({ error: "ProposalInvalid", code: err.code, message: err.message });
      }
      if (err instanceof ApiError) return res.status(err.status).json({ error: err.code, message: err.message });
      console.error("[copilot] confirm followup error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to execute follow-up" });
    }
  });
}
