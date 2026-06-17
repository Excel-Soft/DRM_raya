import { Router, type Request, type Response } from "express";
import {
  itAssetsRepository,
  normalizeServerStatus,
  SERVER_STATUSES,
} from "./repositories/it-assets.repository";
import { requireRole } from "./auth.middleware";
import { AuditLogService } from "./services/audit-log.service";
import { insertItDomainSchema, insertItBackupSchema } from "@shared/schema";

const router = Router();

// /api/it/*

// ---------------------------------------------------------------------------
// Patch 4 Stage 4 — Domain Hosting "Server Names" (reuses it_servers).
// Role gates: /api/it is authenticated (global authMiddleware) but had no role
// enforcement. We add server-side role checks for the Server Names endpoints.
// ---------------------------------------------------------------------------
const IT_READ_ROLES = [
  "admin",
  "super_admin",
  "super_hod",
  "it_manager",
  "it_admin",
  "domain_manager",
  "developer",
];
const IT_WRITE_ROLES = [
  "admin",
  "super_admin",
  "super_hod",
  "it_manager",
  "it_admin",
  "domain_manager",
];

function actorId(req: Request): string | null {
  return (req as any).user?.userId ?? null;
}

// it_servers has no secret columns; we expose the row but normalize status so
// the client always sees the canonical ACTIVE|INACTIVE|SUSPENDED|ARCHIVED set.
function serializeServer(s: any) {
  return { ...s, status: normalizeServerStatus(s?.status) || s?.status || "ACTIVE" };
}

// Accept a hostname, a URL (host is extracted), or an IP address.
function isValidHost(input: string): boolean {
  let host = String(input).trim();
  if (!host) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(host)) {
    try {
      host = new URL(host).hostname;
    } catch {
      return false;
    }
  }
  if (!host) return false;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4.test(host)) {
    return host.split(".").every((o) => Number(o) >= 0 && Number(o) <= 255);
  }
  if (host.includes(":")) return /^[0-9a-fA-F:]+$/.test(host); // loose IPv6
  const hostname =
    /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostname.test(host);
}

async function listServersHandler(req: Request, res: Response) {
  const { search, status, includeArchived } = req.query;
  const list = await itAssetsRepository.listServers({
    search: typeof search === "string" ? search : undefined,
    status: typeof status === "string" ? status : undefined,
    includeArchived: includeArchived === "true" || includeArchived === "1",
  });
  res.json(list.map(serializeServer));
}

async function getServerHandler(req: Request, res: Response) {
  const s = await itAssetsRepository.getServer(req.params.id);
  if (!s || s.deletedAt) return res.status(404).json({ error: "Server not found" });
  res.json(serializeServer(s));
}

async function createServerHandler(req: Request, res: Response) {
  const body = req.body || {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const hostRaw =
    typeof body.ip === "string" ? body.ip : typeof body.host === "string" ? body.host : "";
  const host = String(hostRaw).trim();
  const provider = typeof body.provider === "string" ? body.provider.trim() : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;

  if (!name) return res.status(400).json({ error: "Server name is required" });
  if (!host) return res.status(400).json({ error: "Host / IP is required" });
  if (!isValidHost(host))
    return res.status(400).json({ error: "Host must be a valid hostname, URL, or IP address" });

  let status: string = "ACTIVE";
  if (body.status != null && String(body.status).trim() !== "") {
    const ns = normalizeServerStatus(body.status);
    if (!ns)
      return res.status(400).json({ error: `Status must be one of ${SERVER_STATUSES.join(", ")}` });
    status = ns;
  }

  const dup = await itAssetsRepository.findActiveServerByName(name);
  if (dup) return res.status(409).json({ error: "A server with this name already exists" });

  const userId = actorId(req);
  const created = await itAssetsRepository.createServer({
    name,
    ip: host,
    provider,
    notes,
    status,
    createdBy: userId,
    updatedBy: userId,
  });
  await AuditLogService.record({
    actorUserId: userId ?? undefined,
    action: "it_server.create",
    module: "domain_hosting",
    entityType: "it_server",
    entityId: created.id,
    after: { name, ip: host, provider, status },
    req,
  });
  res.status(201).json(serializeServer(created));
}

async function updateServerHandler(req: Request, res: Response) {
  const id = req.params.id;
  const existing = await itAssetsRepository.getServer(id);
  if (!existing || existing.deletedAt)
    return res.status(404).json({ error: "Server not found" });

  const body = req.body || {};
  const updates: Record<string, any> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return res.status(400).json({ error: "Server name cannot be empty" });
    const dup = await itAssetsRepository.findActiveServerByName(name, id);
    if (dup) return res.status(409).json({ error: "A server with this name already exists" });
    updates.name = name;
  }

  const hostRaw =
    body.ip !== undefined ? body.ip : body.host !== undefined ? body.host : undefined;
  if (typeof hostRaw === "string") {
    const host = hostRaw.trim();
    if (!host) return res.status(400).json({ error: "Host / IP cannot be empty" });
    if (!isValidHost(host))
      return res.status(400).json({ error: "Host must be a valid hostname, URL, or IP address" });
    updates.ip = host;
  }

  if ("provider" in body)
    updates.provider = typeof body.provider === "string" ? body.provider.trim() : null;
  if ("notes" in body)
    updates.notes = typeof body.notes === "string" ? body.notes.trim() : null;

  if (body.status != null && String(body.status).trim() !== "") {
    const ns = normalizeServerStatus(body.status);
    if (!ns)
      return res.status(400).json({ error: `Status must be one of ${SERVER_STATUSES.join(", ")}` });
    updates.status = ns;
  }

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: "No valid fields to update" });

  const userId = actorId(req);
  updates.updatedBy = userId;
  const updated = await itAssetsRepository.updateServer(id, updates);
  await AuditLogService.record({
    actorUserId: userId ?? undefined,
    action: "it_server.update",
    module: "domain_hosting",
    entityType: "it_server",
    entityId: id,
    before: serializeServer(existing),
    after: serializeServer(updated),
    req,
  });
  res.json(serializeServer(updated));
}

async function updateServerStatusHandler(req: Request, res: Response) {
  const id = req.params.id;
  const existing = await itAssetsRepository.getServer(id);
  if (!existing || existing.deletedAt)
    return res.status(404).json({ error: "Server not found" });

  const ns = normalizeServerStatus(req.body?.status);
  if (!ns)
    return res.status(400).json({ error: `Status must be one of ${SERVER_STATUSES.join(", ")}` });

  const userId = actorId(req);
  const updated = await itAssetsRepository.updateServer(id, { status: ns, updatedBy: userId });
  await AuditLogService.recordTransition({
    actorUserId: userId ?? undefined,
    action: "it_server.status_change",
    module: "domain_hosting",
    entityType: "it_server",
    entityId: id,
    previousStatus: normalizeServerStatus(existing.status) || existing.status,
    nextStatus: ns,
    reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
    req,
  });
  res.json(serializeServer(updated));
}

async function deleteServerHandler(req: Request, res: Response) {
  const id = req.params.id;
  const existing = await itAssetsRepository.getServer(id);
  if (!existing || existing.deletedAt)
    return res.status(404).json({ error: "Server not found" });

  const userId = actorId(req);
  const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
  const deleted = await itAssetsRepository.softDeleteServer(id, userId);
  await AuditLogService.record({
    actorUserId: userId ?? undefined,
    action: "it_server.delete",
    module: "domain_hosting",
    entityType: "it_server",
    entityId: id,
    before: serializeServer(existing),
    reason,
    req,
  });
  res.json({ success: true, id, deletedAt: deleted?.deletedAt ?? null });
}

// Canonical path: /api/it/servers. Compatibility alias: /api/it/server-names.
for (const base of ["/servers", "/server-names"]) {
  router.get(base, requireRole(...IT_READ_ROLES), listServersHandler);
  router.get(`${base}/:id`, requireRole(...IT_READ_ROLES), getServerHandler);
  router.post(base, requireRole(...IT_WRITE_ROLES), createServerHandler);
  router.patch(`${base}/:id/status`, requireRole(...IT_WRITE_ROLES), updateServerStatusHandler);
  router.patch(`${base}/:id`, requireRole(...IT_WRITE_ROLES), updateServerHandler);
  router.delete(`${base}/:id`, requireRole(...IT_WRITE_ROLES), deleteServerHandler);
}

// Registries
router.get("/registries", async (req, res) => {
  const list = await itAssetsRepository.listRegistries();
  res.json(list);
});

router.delete("/registries/:id", async (req, res) => {
  await itAssetsRepository.deleteRegistry(req.params.id);
  res.json({ success: true });
});

// Hosting Packages
router.get("/hosting-packages", async (req, res) => {
  const list = await itAssetsRepository.listHostingPackages();
  res.json(list);
});

router.delete("/hosting-packages/:id", async (req, res) => {
  await itAssetsRepository.deleteHostingPackage(req.params.id);
  res.json({ success: true });
});

// Domains
router.get("/domains", async (req, res) => {
  const list = await itAssetsRepository.listDomains();
  res.json(list);
});

router.post("/domains", async (req, res) => {
  const result = insertItDomainSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error);
  const domain = await itAssetsRepository.createDomain(result.data);
  res.json(domain);
});

// Backups
router.get("/backups", async (req, res) => {
  const list = await itAssetsRepository.listBackups();
  res.json(list);
});

router.post("/backups", async (req, res) => {
  const result = insertItBackupSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json(result.error);
  const backup = await itAssetsRepository.createBackup(result.data);
  res.json(backup);
});

router.get("/system-report", async (req, res) => {
  const report = await itAssetsRepository.getSystemReport();
  res.json(report);
});

export default router;
