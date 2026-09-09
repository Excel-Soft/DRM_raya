import { db, pool } from "../db";
import { itServers, itDomains, itBackups, itRegistries, itHostingPackages, customers } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

// Patch 4 Stage 4 — canonical "Server Names" status set. The DB column stays
// `text` for backward-compat; we normalize at the boundary. Legacy values
// ("Active"/"Inactive") uppercase straight into the canonical set.
export const SERVER_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"] as const;
export type ServerStatus = (typeof SERVER_STATUSES)[number];

export function normalizeServerStatus(input: unknown): ServerStatus | null {
  if (input == null) return null;
  const s = String(input).trim().toUpperCase();
  return (SERVER_STATUSES as readonly string[]).includes(s) ? (s as ServerStatus) : null;
}

export interface ListServersOptions {
  search?: string;
  status?: string;
  includeArchived?: boolean;
}

let ensured = false;
async function ensureItSchema() {
  if (ensured) return;
  const ddl = `
    create table if not exists it_servers (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      ip text not null,
      provider text,
      status text not null default 'Active',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists it_registries (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      url text,
      credentials text,
      created_at timestamptz not null default now()
    );
    create table if not exists it_hosting_packages (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      capacity text,
      price decimal(12,2),
      created_at timestamptz not null default now()
    );
    create table if not exists it_domains (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid references drm.customers(id),
      domain_name text not null unique,
      registry_id uuid references it_registries(id),
      server_id uuid references it_servers(id),
      hosting_package_id uuid references it_hosting_packages(id),
      cpanel_username text,
      cpanel_password text,
      activation_date timestamptz,
      expiry_date timestamptz,
      ssl_expiry_date timestamptz,
      hosting_expiry_date timestamptz,
      status text not null default 'Active',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists it_backups (
      id uuid primary key default gen_random_uuid(),
      domain_id uuid references it_domains(id) on delete cascade,
      person_name text,
      backup_type text not null,
      backup_url text,
      details text,
      backup_date timestamptz not null default now(),
      created_at timestamptz not null default now()
    );
    -- Patch 4 Stage 4 (additive, non-destructive): soft-delete + audit columns
    -- for it_servers ("Server Names"). Plain columns, no FK constraints.
    alter table it_servers add column if not exists notes text;
    alter table it_servers add column if not exists deleted_at timestamptz;
    alter table it_servers add column if not exists created_by uuid;
    alter table it_servers add column if not exists updated_by uuid;
    alter table it_servers add column if not exists deleted_by uuid;
  `;
  try {
    await pool.query(ddl);
    ensured = true;
  } catch (err) {
    console.error("Failed ensuring IT assets schema:", err);
  }
}

export const itAssetsRepository = {
  async listServers(opts: ListServersOptions = {}) {
    await ensureItSchema();
    const rows = await db.select().from(itServers).orderBy(desc(itServers.createdAt));
    const search = (opts.search || "").trim().toLowerCase();
    const statusFilter = opts.status ? normalizeServerStatus(opts.status) : null;
    return rows.filter((r) => {
      if (!opts.includeArchived && r.deletedAt) return false;
      if (statusFilter && normalizeServerStatus(r.status) !== statusFilter) return false;
      if (search) {
        const hay = `${r.name || ""} ${r.ip || ""} ${r.provider || ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  },
  async getServer(id: string) {
    await ensureItSchema();
    const [row] = await db.select().from(itServers).where(eq(itServers.id, id));
    return row || null;
  },
  async findActiveServerByName(name: string, excludeId?: string) {
    await ensureItSchema();
    const target = name.trim().toLowerCase();
    const rows = await db.select().from(itServers);
    return (
      rows.find(
        (r) =>
          !r.deletedAt &&
          (r.name || "").trim().toLowerCase() === target &&
          r.id !== excludeId,
      ) || null
    );
  },
  async updateServer(id: string, data: any) {
    await ensureItSchema();
    const [row] = await db
      .update(itServers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(itServers.id, id))
      .returning();
    return row;
  },
  async softDeleteServer(id: string, userId?: string | null) {
    await ensureItSchema();
    const [row] = await db
      .update(itServers)
      .set({
        deletedAt: new Date(),
        deletedBy: userId ?? null,
        updatedBy: userId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(itServers.id, id))
      .returning();
    return row;
  },
  // Patch 6 Stage 6 — domain duplicate guard (column is UNIQUE; this gives a
  // clean 409 before hitting the DB constraint).
  async findDomainByName(name: string) {
    await ensureItSchema();
    const target = String(name || "").trim().toLowerCase();
    if (!target) return null;
    const rows = await db.select().from(itDomains);
    return rows.find((r) => (r.domainName || "").trim().toLowerCase() === target) || null;
  },
  async getRegistry(id: string) {
    await ensureItSchema();
    const [row] = await db.select().from(itRegistries).where(eq(itRegistries.id, id));
    return row || null;
  },
  async getHostingPackage(id: string) {
    await ensureItSchema();
    const [row] = await db.select().from(itHostingPackages).where(eq(itHostingPackages.id, id));
    return row || null;
  },
  async createRegistry(data: any) {
    await ensureItSchema();
    const [row] = await db.insert(itRegistries).values(data).returning();
    return row;
  },
  async createHostingPackage(data: any) {
    await ensureItSchema();
    const [row] = await db.insert(itHostingPackages).values(data).returning();
    return row;
  },
  async listRegistries() {
    await ensureItSchema();
    return db.select().from(itRegistries).orderBy(desc(itRegistries.createdAt));
  },
  async listHostingPackages() {
    await ensureItSchema();
    return db.select().from(itHostingPackages).orderBy(desc(itHostingPackages.createdAt));
  },
  async listDomains() {
    await ensureItSchema();
    const rows = await db
      .select({
        id: itDomains.id,
        customerId: itDomains.customerId,
        domainName: itDomains.domainName,
        registryId: itDomains.registryId,
        serverId: itDomains.serverId,
        hostingPackageId: itDomains.hostingPackageId,
        cpanelUsername: itDomains.cpanelUsername,
        cpanelPassword: itDomains.cpanelPassword,
        activationDate: itDomains.activationDate,
        expiryDate: itDomains.expiryDate,
        sslExpiryDate: itDomains.sslExpiryDate,
        hostingExpiryDate: itDomains.hostingExpiryDate,
        status: itDomains.status,
        createdAt: itDomains.createdAt,
        updatedAt: itDomains.updatedAt,
        company: customers.companyName,
        email: customers.email,
        contactNo: customers.phone,
        hostingPackageName: itHostingPackages.name,
        hostingPackagePrice: itHostingPackages.price,
        serverName: itServers.name,
        serverIp: itServers.ip,
        registryName: itRegistries.name,
      })
      .from(itDomains)
      .leftJoin(customers, eq(itDomains.customerId, customers.id))
      .leftJoin(itHostingPackages, eq(itDomains.hostingPackageId, itHostingPackages.id))
      .leftJoin(itServers, eq(itDomains.serverId, itServers.id))
      .leftJoin(itRegistries, eq(itDomains.registryId, itRegistries.id))
      .orderBy(desc(itDomains.createdAt));
    return rows;
  },
  async updateDomain(id: string, data: any) {
    await ensureItSchema();
    const [row] = await db
      .update(itDomains)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(itDomains.id, id))
      .returning();
    return row;
  },
  async deleteDomain(id: string) {
    await ensureItSchema();
    await db.delete(itDomains).where(eq(itDomains.id, id));
    return { success: true };
  },
  async deleteBackup(id: string) {
    await ensureItSchema();
    await db.delete(itBackups).where(eq(itBackups.id, id));
    return { success: true };
  },
  async listBackups() {
    await ensureItSchema();
    return db.select().from(itBackups).orderBy(desc(itBackups.createdAt));
  },
  async createServer(data: any) {
    await ensureItSchema();
    const [row] = await db.insert(itServers).values(data).returning();
    return row;
  },
  async createDomain(data: any) {
    await ensureItSchema();
    const [row] = await db.insert(itDomains).values(data).returning();
    return row;
  },
  async createBackup(data: any) {
    await ensureItSchema();
    const [row] = await db.insert(itBackups).values(data).returning();
    return row;
  },
  async deleteServer(id: string) {
    await ensureItSchema();
    await db.delete(itServers).where(eq(itServers.id, id));
    return { success: true };
  },
  async deleteRegistry(id: string) {
    await ensureItSchema();
    await db.delete(itRegistries).where(eq(itRegistries.id, id));
    return { success: true };
  },
  async deleteHostingPackage(id: string) {
    await ensureItSchema();
    await db.delete(itHostingPackages).where(eq(itHostingPackages.id, id));
    return { success: true };
  },
  async getSystemReport() {
    await ensureItSchema();
    const servers = await this.listServers();
    const domains = await this.listDomains();
    const backups = await this.listBackups();
    
    const report: any[] = [];
    
    servers.forEach(s => report.push({
      id: s.id,
      name: s.name,
      type: 'Server',
      ip: s.ip,
      status: s.status,
      lastBackup: null,
      expiryDate: null,
      serverUrl: s.ip
    }));
    
    domains.forEach(d => {
      const domainBackups = backups.filter(b => b.domainId === d.id);
      const lastBackup = domainBackups.length > 0
        ? domainBackups.sort((a, b) => new Date(b.backupDate).getTime() - new Date(a.backupDate).getTime())[0].backupDate
        : null;

      report.push({
        id: d.id,
        name: d.domainName,
        type: 'Domain',
        ip: '-',
        status: d.status,
        lastBackup,
        expiryDate: d.expiryDate,
        serverUrl: d.domainName
      });
    });
    
    return report;
  }
};
