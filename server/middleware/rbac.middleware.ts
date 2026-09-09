import { Request, Response, NextFunction } from "express";
import { rolePermissionsRepository } from "../repositories/permissions.repository";
import { rolesRepository } from "../repositories/roles.repository";
import memoizee from "memoizee";

export interface RequiredPermission {
  module: string;
  action: string;
}

const cachedGetRoleById = memoizee(
  async (roleId: string) => rolesRepository.findById(roleId),
  { 
    promise: true, 
    maxAge: 5 * 60 * 1000,
    preFetch: true,
  }
);

const cachedHasPermission = memoizee(
  async (roleName: string, module: string, action: string) => 
    rolePermissionsRepository.hasPermission(roleName, module, action),
  { 
    promise: true, 
    maxAge: 5 * 60 * 1000,
    preFetch: true,
  }
);

export function clearPermissionCache() {
  cachedGetRoleById.clear();
  cachedHasPermission.clear();
}

export function requirePermission(...requiredPermissions: RequiredPermission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userRoleId = req.user.roleId;
      if (!userRoleId) {
        return res.status(403).json({ error: "No role assigned" });
      }

      const role = await cachedGetRoleById(userRoleId);
      if (!role) {
        return res.status(403).json({ error: "Role not found" });
      }

      for (const required of requiredPermissions) {
        const hasPermission = await cachedHasPermission(
          role.name,
          required.module,
          required.action
        );

        if (!hasPermission) {
          return res.status(403).json({
            error: "Insufficient permissions",
            required: `${required.module}:${required.action}`,
          });
        }
      }

      next();
    } catch (error) {
      console.error("Error checking permissions:", error);
      return res.status(500).json({ error: "Failed to verify permissions" });
    }
  };
}

export function requireAnyPermission(...requiredPermissions: RequiredPermission[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userRoleId = req.user.roleId;
      if (!userRoleId) {
        return res.status(403).json({ error: "No role assigned" });
      }

      const role = await cachedGetRoleById(userRoleId);
      if (!role) {
        return res.status(403).json({ error: "Role not found" });
      }

      for (const required of requiredPermissions) {
        const hasPermission = await cachedHasPermission(
          role.name,
          required.module,
          required.action
        );

        if (hasPermission) {
          return next();
        }
      }

      return res.status(403).json({
        error: "Insufficient permissions",
        required: requiredPermissions.map((p) => `${p.module}:${p.action}`).join(" OR "),
      });
    } catch (error) {
      console.error("Error checking permissions:", error);
      return res.status(500).json({ error: "Failed to verify permissions" });
    }
  };
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const userRoleId = req.user.roleId;
      if (!userRoleId) {
        return res.status(403).json({ error: "No role assigned" });
      }

      const role = await cachedGetRoleById(userRoleId);
      if (!role) {
        return res.status(403).json({ error: "Role not found" });
      }

      if (!allowedRoles.includes(role.name)) {
        return res.status(403).json({
          error: "Role not authorized",
          required: allowedRoles.join(" OR "),
        });
      }

      next();
    } catch (error) {
      console.error("Error checking role:", error);
      return res.status(500).json({ error: "Failed to verify role" });
    }
  };
}

export const permissions = {
  customers: {
    read: { module: "customers", action: "read" },
    write: { module: "customers", action: "write" },
    delete: { module: "customers", action: "delete" },
    approve: { module: "customers", action: "approve" },
    manage: { module: "customers", action: "manage" },
  },
  pms: {
    read: { module: "pms", action: "read" },
    write: { module: "pms", action: "write" },
    delete: { module: "pms", action: "delete" },
    approve: { module: "pms", action: "approve" },
    manage: { module: "pms", action: "manage" },
  },
  hr: {
    read: { module: "hr", action: "read" },
    write: { module: "hr", action: "write" },
    approve: { module: "hr", action: "approve" },
    manage: { module: "hr", action: "manage" },
  },
  support: {
    read: { module: "support", action: "read" },
    write: { module: "support", action: "write" },
    manage: { module: "support", action: "manage" },
  },
  reports: {
    read: { module: "reports", action: "read" },
    export: { module: "reports", action: "export" },
    team: { module: "reports", action: "team" },
    manage: { module: "reports", action: "manage" },
  },
  settings: {
    read: { module: "settings", action: "read" },
    write: { module: "settings", action: "write" },
    manage: { module: "settings", action: "manage" },
  },
  training: {
    read: { module: "training", action: "read" },
    manage: { module: "training", action: "manage" },
  },
};
