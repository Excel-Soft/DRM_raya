import { db } from "../db";
import { permissions, rolePermissions, roles, InsertPermission, Permission, InsertRolePermission, RolePermission } from "@models/schema";
import { eq, and, inArray } from "drizzle-orm";

export const permissionsRepository = {
  async findById(id: string): Promise<Permission | undefined> {
    const result = await db.select().from(permissions).where(eq(permissions.id, id)).limit(1);
    return result[0];
  },

  async findByName(name: string): Promise<Permission | undefined> {
    const result = await db.select().from(permissions).where(eq(permissions.name, name)).limit(1);
    return result[0];
  },

  async findAll(): Promise<Permission[]> {
    return db.select().from(permissions);
  },

  async findByModule(module: string): Promise<Permission[]> {
    return db.select().from(permissions).where(eq(permissions.module, module));
  },

  async create(data: InsertPermission): Promise<Permission> {
    const result = await db.insert(permissions).values(data).returning();
    return result[0];
  },

  async delete(id: string): Promise<void> {
    await db.delete(permissions).where(eq(permissions.id, id));
  },
};

export const rolePermissionsRepository = {
  async findByRoleId(roleId: string): Promise<Array<RolePermission & { permission: Permission }>> {
    const result = await db
      .select({
        id: rolePermissions.id,
        roleId: rolePermissions.roleId,
        permissionId: rolePermissions.permissionId,
        createdAt: rolePermissions.createdAt,
        updatedAt: rolePermissions.updatedAt,
        permission: permissions,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));

    return result.map((r) => ({
      ...r,
      permission: r.permission!,
    }));
  },

  async findByRoleName(roleName: string): Promise<Permission[]> {
    const role = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
    
    if (!role[0]) {
      return [];
    }

    const result = await db
      .select({ permission: permissions })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, role[0].id));

    return result.map((r) => r.permission);
  },

  async create(data: InsertRolePermission): Promise<RolePermission> {
    const result = await db.insert(rolePermissions).values(data).returning();
    return result[0];
  },

  async delete(roleId: string, permissionId: string): Promise<void> {
    await db
      .delete(rolePermissions)
      .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
  },

  async hasPermission(roleName: string, module: string, action: string): Promise<boolean> {
    const role = await db.select().from(roles).where(eq(roles.name, roleName)).limit(1);
    
    if (!role[0]) {
      return false;
    }

    const result = await db
      .select()
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(
        and(
          eq(rolePermissions.roleId, role[0].id),
          eq(permissions.module, module),
          eq(permissions.action, action)
        )
      )
      .limit(1);

    return result.length > 0;
  },

  async bulkAssign(roleId: string, permissionIds: string[]): Promise<RolePermission[]> {
    const values = permissionIds.map((permissionId) => ({
      roleId,
      permissionId,
    }));

    const result = await db.insert(rolePermissions).values(values).returning();
    return result;
  },

  async removeAll(roleId: string): Promise<void> {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  },
};
