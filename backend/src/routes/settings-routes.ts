import { Router, type Request, type Response, type Express } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { rolesRepository } from "../repositories/roles.repository";
import { urlPermissionsRepository } from "../repositories/url-permissions.repository";
import { policiesRepository } from "../repositories/policies.repository";
import { allowedIpsRepository } from "../repositories/allowed-ips.repository";
import {
  insertRoleSchema,
  insertUrlPermissionSchema,
  insertPolicySchema,
  insertAllowedIpSchema,
  attributes
} from "@models/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { ActivityLogService } from "../services/activity-service";
import { getConfig, patchConfig } from "../services/gm-sales-config.service";
import { AuditLogService } from "../services/audit-log.service";

// Accepts a bare IPv4/IPv6 address or a CIDR block (e.g. 192.168.1.0/24,
// 2001:db8::/32). Kept intentionally conservative — it rejects obviously
// malformed input rather than guaranteeing canonical form.
function isValidIpOrCidr(value: string): boolean {
  const input = (value || "").trim();
  if (!input) return false;
  const [addr, prefix, ...rest] = input.split("/");
  if (rest.length > 0) return false;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = addr.match(ipv4);
  if (ipv4Match) {
    const octetsOk = ipv4Match.slice(1).every((o) => Number(o) >= 0 && Number(o) <= 255);
    if (!octetsOk) return false;
    if (prefix === undefined) return true;
    const p = Number(prefix);
    return Number.isInteger(p) && p >= 0 && p <= 32;
  }

  // Loose IPv6 check: hex groups separated by ':' (allowing :: compression).
  const ipv6 = /^[0-9a-fA-F:]+$/;
  if (addr.includes(":") && ipv6.test(addr) && addr.length >= 2) {
    if (prefix === undefined) return true;
    const p = Number(prefix);
    return Number.isInteger(p) && p >= 0 && p <= 128;
  }

  return false;
}

export function registerSettingsRoutes(app: Express) {
  // Auth is enforced globally in `server/routes.ts` (or via MOCK_AUTH when enabled).
  app.use("/api/settings", authMiddleware);

  const settingsRouter = Router();

  // ========================================
  // Roles Routes
  // ========================================

  settingsRouter.get("/roles", async (req: Request, res: Response) => {
    try {
      const roles = await rolesRepository.findAll();

      // Also fetch Job Designation attributes to merge
      const jobDesignations = await db.select().from(attributes).where(eq(attributes.category, "Job Designation"));

      const allRolesMap = new Map();
      // Prioritize existing roles table roles
      for (const r of roles) {
        allRolesMap.set(r.name.toLowerCase(), r);
      }

      // Add missing job designations
      for (const attr of jobDesignations) {
        const normalizedName = attr.name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        if (!allRolesMap.has(normalizedName)) {
          allRolesMap.set(normalizedName, {
            id: attr.id,
            name: normalizedName,
            description: attr.name,
            createdAt: attr.createdAt,
            updatedAt: attr.updatedAt
          });
        }
      }

      res.json(Array.from(allRolesMap.values()));
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  settingsRouter.get("/roles/:id", async (req: Request, res: Response) => {
    try {
      const role = await rolesRepository.findById(req.params.id);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error: any) {
      console.error("Error fetching role:", error);
      res.status(500).json({ error: "Failed to fetch role" });
    }
  });

  settingsRouter.post("/roles", async (req: Request, res: Response) => {
    try {
      const data = insertRoleSchema.parse(req.body);
      const role = await rolesRepository.create(data);
      res.status(201).json(role);
    } catch (error: any) {
      console.error("Error creating role:", error);
      res.status(400).json({ error: error.message || "Failed to create role" });
    }
  });

  settingsRouter.patch("/roles/:id", async (req: Request, res: Response) => {
    try {
      const data = insertRoleSchema.partial().parse(req.body);
      const role = await rolesRepository.update(req.params.id, data);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error: any) {
      console.error("Error updating role:", error);
      res.status(400).json({ error: error.message || "Failed to update role" });
    }
  });

  settingsRouter.delete("/roles/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await rolesRepository.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting role:", error);
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // ========================================
  // URL Permissions Routes
  // ========================================

  settingsRouter.get("/url-permissions", async (req: Request, res: Response) => {
    try {
      const permissions = await urlPermissionsRepository.findAll();
      res.json(permissions);
    } catch (error: any) {
      console.error("Error fetching URL permissions:", error);
      res.status(500).json({ error: "Failed to fetch URL permissions" });
    }
  });

  settingsRouter.get("/url-permissions/:id", async (req: Request, res: Response) => {
    try {
      const permission = await urlPermissionsRepository.findById(req.params.id);
      if (!permission) {
        return res.status(404).json({ error: "URL permission not found" });
      }
      res.json(permission);
    } catch (error: any) {
      console.error("Error fetching URL permission:", error);
      res.status(500).json({ error: "Failed to fetch URL permission" });
    }
  });

  settingsRouter.post("/url-permissions", async (req: Request, res: Response) => {
    try {
      const data = insertUrlPermissionSchema.parse(req.body);
      // Upsert by path (create if not exists, update if exists)
      const permission = await urlPermissionsRepository.upsertByPath(data.path, data);
      res.status(201).json(permission);
    } catch (error: any) {
      console.error("Error creating/updating URL permission:", error);
      res.status(400).json({ error: error.message || "Failed to create/update URL permission" });
    }
  });

  settingsRouter.patch("/url-permissions/:id", async (req: Request, res: Response) => {
    try {
      const data = insertUrlPermissionSchema.partial().parse(req.body);
      const permission = await urlPermissionsRepository.update(req.params.id, data);
      if (!permission) {
        return res.status(404).json({ error: "URL permission not found" });
      }
      res.json(permission);
    } catch (error: any) {
      console.error("Error updating URL permission:", error);
      res.status(400).json({ error: error.message || "Failed to update URL permission" });
    }
  });

  settingsRouter.delete("/url-permissions/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await urlPermissionsRepository.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "URL permission not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting URL permission:", error);
      res.status(500).json({ error: "Failed to delete URL permission" });
    }
  });

  // ========================================
  // Policies Routes
  // ========================================

  settingsRouter.get("/policies", async (req: Request, res: Response) => {
    try {
      const policies = await policiesRepository.findAll();
      res.json(policies);
    } catch (error: any) {
      console.error("Error fetching policies:", error);
      res.status(500).json({ error: "Failed to fetch policies" });
    }
  });

  settingsRouter.get("/policies/:key", async (req: Request, res: Response) => {
    try {
      const policy = await policiesRepository.findByKey(req.params.key);
      if (!policy) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json(policy);
    } catch (error: any) {
      console.error("Error fetching policy:", error);
      res.status(500).json({ error: "Failed to fetch policy" });
    }
  });

  settingsRouter.post("/policies", async (req: Request, res: Response) => {
    try {
      const data = insertPolicySchema.parse(req.body);
      // Upsert by key (create if not exists, update if exists)
      const policy = await policiesRepository.upsertByKey(data.key, data);
      res.status(201).json(policy);
    } catch (error: any) {
      console.error("Error creating/updating policy:", error);
      res.status(400).json({ error: error.message || "Failed to create/update policy" });
    }
  });

  settingsRouter.patch("/policies/:key", async (req: Request, res: Response) => {
    try {
      const existing = await policiesRepository.findByKey(req.params.key);
      if (!existing) {
        return res.status(404).json({ error: "Policy not found" });
      }
      const data = insertPolicySchema.partial().parse(req.body);
      const policy = await policiesRepository.update(existing.id, data);
      res.json(policy);
    } catch (error: any) {
      console.error("Error updating policy:", error);
      res.status(400).json({ error: error.message || "Failed to update policy" });
    }
  });

  settingsRouter.delete("/policies/:key", async (req: Request, res: Response) => {
    try {
      const existing = await policiesRepository.findByKey(req.params.key);
      if (!existing) {
        return res.status(404).json({ error: "Policy not found" });
      }
      const deleted = await policiesRepository.delete(existing.id);
      if (!deleted) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting policy:", error);
      res.status(500).json({ error: "Failed to delete policy" });
    }
  });

  // ========================================
  // Allowed IPs Routes
  // ========================================

  settingsRouter.get("/allowed-ips", async (req: Request, res: Response) => {
    try {
      const allowedIps = await allowedIpsRepository.findAll();
      res.json(allowedIps);
    } catch (error: any) {
      console.error("Error fetching allowed IPs:", error);
      res.status(500).json({ error: "Failed to fetch allowed IPs" });
    }
  });

  settingsRouter.get("/allowed-ips/:id", async (req: Request, res: Response) => {
    try {
      const allowedIp = await allowedIpsRepository.findById(req.params.id);
      if (!allowedIp) {
        return res.status(404).json({ error: "Allowed IP not found" });
      }
      res.json(allowedIp);
    } catch (error: any) {
      console.error("Error fetching allowed IP:", error);
      res.status(500).json({ error: "Failed to fetch allowed IP" });
    }
  });

  settingsRouter.post("/allowed-ips", async (req: Request, res: Response) => {
    try {
      const data = insertAllowedIpSchema.parse(req.body);
      const ipCidr = data.ip_cidr?.trim();
      if (!ipCidr || !isValidIpOrCidr(ipCidr)) {
        return res.status(400).json({ error: "Enter a valid IP address or CIDR block (e.g. 203.0.113.5 or 192.168.1.0/24)." });
      }
      const existing = await allowedIpsRepository.findByIp(ipCidr);
      if (existing) {
        return res.status(409).json({ error: "This IP/CIDR is already in the allowed list." });
      }
      const allowedIp = await allowedIpsRepository.create({ ...data, ip_cidr: ipCidr });
      await ActivityLogService.log({
        userId: req.user?.userId,
        action: "allowed_ip.create",
        resourceType: "allowed_ip",
        resourceId: allowedIp.id,
        details: `Added allowed IP ${allowedIp.ip_cidr}`,
      });
      res.status(201).json(allowedIp);
    } catch (error: any) {
      console.error("Error creating allowed IP:", error);
      res.status(400).json({ error: error.message || "Failed to create allowed IP" });
    }
  });

  settingsRouter.patch("/allowed-ips/:id", async (req: Request, res: Response) => {
    try {
      const data = insertAllowedIpSchema.partial().parse(req.body);
      if (data.ip_cidr !== undefined) {
        const ipCidr = data.ip_cidr?.trim();
        if (!ipCidr || !isValidIpOrCidr(ipCidr)) {
          return res.status(400).json({ error: "Enter a valid IP address or CIDR block (e.g. 203.0.113.5 or 192.168.1.0/24)." });
        }
        const existing = await allowedIpsRepository.findByIp(ipCidr);
        if (existing && existing.id !== req.params.id) {
          return res.status(409).json({ error: "This IP/CIDR is already in the allowed list." });
        }
        data.ip_cidr = ipCidr;
      }
      const allowedIp = await allowedIpsRepository.update(req.params.id, {
        ...data,
        updatedAt: new Date(),
      } as any);
      if (!allowedIp) {
        return res.status(404).json({ error: "Allowed IP not found" });
      }
      await ActivityLogService.log({
        userId: req.user?.userId,
        action: "allowed_ip.update",
        resourceType: "allowed_ip",
        resourceId: allowedIp.id,
        details: `Updated allowed IP ${allowedIp.ip_cidr} (active=${allowedIp.is_active})`,
      });
      res.json(allowedIp);
    } catch (error: any) {
      console.error("Error updating allowed IP:", error);
      res.status(400).json({ error: error.message || "Failed to update allowed IP" });
    }
  });

  settingsRouter.delete("/allowed-ips/:id", async (req: Request, res: Response) => {
    try {
      const target = await allowedIpsRepository.findById(req.params.id);
      const deleted = await allowedIpsRepository.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Allowed IP not found" });
      }
      await ActivityLogService.log({
        userId: req.user?.userId,
        action: "allowed_ip.delete",
        resourceType: "allowed_ip",
        resourceId: req.params.id,
        details: `Removed allowed IP ${target?.ip_cidr ?? req.params.id}`,
      });
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting allowed IP:", error);
      res.status(500).json({ error: "Failed to delete allowed IP" });
    }
  });

  // ========================================
  // GM Sales Workflow Config Routes (MD-8 Admin Feature Toggle Controls)
  // ========================================
  settingsRouter.get("/gm-sales-config", async (req: Request, res: Response) => {
    try {
      const data = await getConfig();
      res.json(data);
    } catch (error: any) {
      console.error("Error fetching GM sales config:", error);
      res.status(500).json({ error: "Failed to fetch GM sales config" });
    }
  });

  settingsRouter.patch("/gm-sales-config", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.userId;
      const userRole = String((req.user as any)?.activeRoleId || (req.user as any)?.roleId || "").toLowerCase();
      if (!["admin", "super_hod"].includes(userRole)) {
        return res.status(403).json({ error: "Only Admins and Super HODs can update GM sales configuration." });
      }

      const result = await patchConfig(req.body, userId);
      await AuditLogService.record({
        actorUserId: userId,
        actorRole: userRole,
        action: "gm_sales_config.update",
        module: "settings",
        entityType: "gm_sales_config",
        entityId: "system",
        after: result.config,
        reason: "Administrative configuration update",
        req,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error updating GM sales config:", error);
      res.status(400).json({ error: error.message || "Failed to update GM sales config" });
    }
  });

  // Register the settings router
  app.use("/api/settings", settingsRouter);
}
