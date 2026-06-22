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

// Patch 6 Stage 6 — credential safety. The it_domains.cpanel_password and
// it_registries.credentials columns are plaintext text columns. We never return
// their values to any client; instead we expose a boolean "set" flag so the UI
// can show whether a credential exists without leaking it.
function serializeDomain(d: any) {
  if (!d) return d;
  const { cpanelPassword, cpanel_password, ...rest } = d;
  return { ...rest, cpanelPasswordSet: !!(cpanelPassword ?? cpanel_password) };
}

function serializeRegistry(r: any) {
  if (!r) return r;
  const { credentials, ...rest } = r;
  return { ...rest, credentialsSet: !!credentials };
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
router.get("/registries", requireRole(...IT_READ_ROLES), async (req, res) => {
  const list = await itAssetsRepository.listRegistries();
  res.json(list.map(serializeRegistry));
});

router.post("/registries", requireRole(...IT_WRITE_ROLES), async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "Registry name is required" });
  const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : null;
  // SECURITY: do not accept/persist plaintext registry credentials.
  const userId = actorId(req);
  const created = await itAssetsRepository.createRegistry({ name, url });
  await AuditLogService.record({
    actorUserId: userId ?? undefined,
    action: "it_registry.create",
    module: "domain_hosting",
    entityType: "it_registry",
    entityId: created.id,
    after: serializeRegistry(created),
    req,
  });
  res.status(201).json(serializeRegistry(created));
});

router.delete("/registries/:id", requireRole(...IT_WRITE_ROLES), async (req, res) => {
  const existing = await itAssetsRepository.getRegistry(req.params.id);
  if (!existing) return res.status(404).json({ error: "Registry not found" });
  await itAssetsRepository.deleteRegistry(req.params.id);
  const userId = actorId(req);
  await AuditLogService.record({
    actorUserId: userId ?? undefined,
    action: "it_registry.delete",
    module: "domain_hosting",
    entityType: "it_registry",
    entityId: req.params.id,
    before: serializeRegistry(existing),
    req,
  });
  res.json({ success: true });
});

// Hosting Packages
router.get("/hosting-packages", requireRole(...IT_READ_ROLES), async (req, res) => {
  const list = await itAssetsRepository.listHostingPackages();
  res.json(list);
});

router.post("/hosting-packages", requireRole(...IT_WRITE_ROLES), async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return res.status(400).json({ error: "Hosting package name is required" });
  const capacity =
    typeof body.capacity === "string" && body.capacity.trim() ? body.capacity.trim() : null;
  let price: string | null = null;
  if (body.price != null && String(body.price).trim() !== "") {
    const n = Number(body.price);
    if (!Number.isFinite(n) || n < 0)
      return res.status(400).json({ error: "Price must be a non-negative number" });
    price = String(n);
  }
  const userId = actorId(req);
  const created = await itAssetsRepository.createHostingPackage({ name, capacity, price });
  await AuditLogService.record({
    actorUserId: userId ?? undefined,
    action: "it_hosting_package.create",
    module: "domain_hosting",
    entityType: "it_hosting_package",
    entityId: created.id,
    after: created,
    req,
  });
  res.status(201).json(created);
});

router.delete("/hosting-packages/:id", requireRole(...IT_WRITE_ROLES), async (req, res) => {
  const existing = await itAssetsRepository.getHostingPackage(req.params.id);
  if (!existing) return res.status(404).json({ error: "Hosting package not found" });
  await itAssetsRepository.deleteHostingPackage(req.params.id);
  const userId = actorId(req);
  await AuditLogService.record({
    actorUserId: userId ?? undefined,
    action: "it_hosting_package.delete",
    module: "domain_hosting",
    entityType: "it_hosting_package",
    entityId: req.params.id,
    before: existing,
    req,
  });
  res.json({ success: true });
});

// Domains
router.get("/domains", requireRole(...IT_READ_ROLES), async (req, res) => {
  const list = await itAssetsRepository.listDomains();
  res.json(list.map(serializeDomain));
});

router.post("/domains", requireRole(...IT_WRITE_ROLES), async (req, res) => {
  const body: Record<string, any> = { ...(req.body || {}) };
  // SECURITY (Patch 6 Stage 6): never persist plaintext credentials.
  delete body.cpanelPassword;
  delete body.cpanel_password;

  const domainName = typeof body.domainName === "string" ? body.domainName.trim() : "";
  if (!domainName) return res.status(400).json({ error: "Domain name is required" });
  if (!isValidHost(domainName))
    return res.status(400).json({ error: "Domain name must be a valid hostname" });

  const dup = await itAssetsRepository.findDomainByName(domainName);
  if (dup) return res.status(409).json({ error: "A domain with this name already exists" });

  const result = insertItDomainSchema.safeParse({ ...body, domainName });
  if (!result.success) return res.status(400).json(result.error);

  // Defensive: strip any secret that survived schema parsing.
  const data: any = { ...result.data };
  delete data.cpanelPassword;

  const userId = actorId(req);
  let created;
  try {
    created = await itAssetsRepository.createDomain(data);
  } catch (e: any) {
    if (String(e?.code) === "23505")
      return res.status(409).json({ error: "A domain with this name already exists" });
    throw e;
  }
  await AuditLogService.record({
    actorUserId: userId ?? undefined,
    action: "it_domain.create",
    module: "domain_hosting",
    entityType: "it_domain",
    entityId: created.id,
    after: serializeDomain(created),
    req,
  });
  res.status(201).json(serializeDomain(created));
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
