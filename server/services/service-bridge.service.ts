/**
 * Patch 6 Stage 5 — Service -> GM / VAS / BV bridge service.
 *
 * Central chokepoint for the Service module's outbound bridges. Owns the
 * `drm.service_bridge_links` table (runtime-ensured; `db:push` is broken) and
 * the three orchestrators.
 *
 * SAFETY / SCOPE
 *  - Every bridge is config-gated and DISABLED by default (see
 *    `service-bridge-config.service.ts`). The route layer returns 403
 *    "Service bridge is not enabled" when a flag is off; this service only runs
 *    on the enabled path.
 *  - BV and VAS reuse their CANONICAL repositories (`bvReportsRepository.create`,
 *    `vasReportsRepository.create`) — the exact code the BV/VAS routes use — so
 *    no business logic is duplicated. The repositories validate via their zod
 *    insert schemas, which strip unknown keys (raw req.body is never inserted).
 *  - GM has NO reusable creator: the canonical GM entry is built by a ~440-line,
 *    response-interleaved, test-less route handler (`gm-pool-routes.ts`). Per the
 *    hard "do not rewrite working services" constraint, the GM bridge records the
 *    linkage (and optionally links to an existing GM entry) instead of forking
 *    that financial pipeline. See SERVICE_BRIDGE_DECISION.md. GM creation stays
 *    owned by the GM module.
 *  - A unique partial index blocks a second ACTIVE link for the same
 *    (service_record_id, target_module). Replacing an existing link is an
 *    explicit override that requires a managerial role + a reason.
 *  - Audit (AuditLogService) and notification (NotificationService) are
 *    best-effort and never throw to the caller.
 */
import type { Request } from "express";
import { pool } from "../db";
import { AuditLogService } from "./audit-log.service";
import { NotificationService } from "./notification-service";
import { isManagerialRole } from "../utils/role-utils";
import { bvReportsRepository } from "../repositories/bv-reports.repository";
import { vasReportsRepository } from "../repositories/generic-report.repository";
import {
  SERVICE_BRIDGE_TARGETS,
  type ServiceBridgeTarget,
} from "../../shared/service-bridge-constants";

const LINKS_TABLE = "drm.service_bridge_links";
let linksEnsured = false;

/** Create + index the bridge-links table. Idempotent. */
export async function ensureBridgeLinksTable(): Promise<void> {
  if (linksEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${LINKS_TABLE} (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      service_record_id varchar NOT NULL,
      target_module varchar NOT NULL,
      target_record_id varchar,
      status varchar NOT NULL DEFAULT 'active',
      created_by varchar,
      override_reason text,
      metadata jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  // At most one ACTIVE bridge per (service record, target module) — blocks dupes.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_service_bridge_active
      ON ${LINKS_TABLE} (service_record_id, target_module)
      WHERE status = 'active';
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_service_bridge_service_record
       ON ${LINKS_TABLE} (service_record_id);`,
  );
  linksEnsured = true;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class ServiceBridgeError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ServiceBridgeError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Map a thrown error onto an HTTP response. Returns true if it handled it. */
export function mapServiceBridgeError(res: any, error: unknown): boolean {
  if (error instanceof ServiceBridgeError) {
    res
      .status(error.status)
      .json({ success: false, error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Link rows
// ---------------------------------------------------------------------------
export interface BridgeLink {
  id: string;
  serviceRecordId: string;
  targetModule: string;
  targetRecordId: string | null;
  status: string;
  createdBy: string | null;
  overrideReason: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

const LINK_COLUMNS = `
  id,
  service_record_id AS "serviceRecordId",
  target_module     AS "targetModule",
  target_record_id  AS "targetRecordId",
  status,
  created_by        AS "createdBy",
  override_reason    AS "overrideReason",
  metadata,
  created_at        AS "createdAt",
  updated_at        AS "updatedAt"`;

export async function findActiveLink(
  serviceRecordId: string,
  targetModule: ServiceBridgeTarget,
): Promise<BridgeLink | null> {
  await ensureBridgeLinksTable();
  const { rows } = await pool.query<BridgeLink>(
    `SELECT ${LINK_COLUMNS} FROM ${LINKS_TABLE}
      WHERE service_record_id = $1 AND target_module = $2 AND status = 'active'
      LIMIT 1`,
    [serviceRecordId, targetModule],
  );
  return rows[0] ?? null;
}

export async function listLinks(serviceRecordId: string): Promise<BridgeLink[]> {
  await ensureBridgeLinksTable();
  const { rows } = await pool.query<BridgeLink>(
    `SELECT ${LINK_COLUMNS} FROM ${LINKS_TABLE}
      WHERE service_record_id = $1
      ORDER BY created_at DESC`,
    [serviceRecordId],
  );
  return rows;
}

interface CreateLinkInput {
  serviceRecordId: string;
  targetModule: ServiceBridgeTarget;
  targetRecordId?: string | null;
  createdBy?: string | null;
  overrideReason?: string | null;
  metadata?: unknown;
}

export async function createBridgeLink(input: CreateLinkInput): Promise<BridgeLink> {
  await ensureBridgeLinksTable();
  const { rows } = await pool.query<BridgeLink>(
    `INSERT INTO ${LINKS_TABLE}
       (service_record_id, target_module, target_record_id, status, created_by, override_reason, metadata)
     VALUES ($1, $2, $3, 'active', $4, $5, $6::jsonb)
     RETURNING ${LINK_COLUMNS}`,
    [
      input.serviceRecordId,
      input.targetModule,
      input.targetRecordId ?? null,
      input.createdBy ?? null,
      input.overrideReason ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
  return rows[0];
}

async function supersedeLink(id: string): Promise<void> {
  await pool.query(
    `UPDATE ${LINKS_TABLE} SET status = 'superseded', updated_at = now() WHERE id = $1`,
    [id],
  );
}

// ---------------------------------------------------------------------------
// Service-customer lookup
// ---------------------------------------------------------------------------
interface ServiceCustomerRow {
  id: string;
  customerId: string;
  companyId: string | null;
  packageId: string | null;
  status: string;
  assignedTo: string | null;
}

async function requireServiceCustomer(id: string | undefined): Promise<ServiceCustomerRow> {
  if (!id || !String(id).trim()) {
    throw new ServiceBridgeError(
      400,
      "SERVICE_RECORD_REQUIRED",
      "serviceCustomerId (service record id) is required.",
    );
  }
  const { rows } = await pool.query<ServiceCustomerRow>(
    `SELECT id,
            customer_id AS "customerId",
            company_id  AS "companyId",
            package_id  AS "packageId",
            status,
            assigned_to AS "assignedTo"
       FROM drm.service_customers WHERE id = $1 LIMIT 1`,
    [String(id).trim()],
  );
  const sc = rows[0];
  if (!sc) {
    throw new ServiceBridgeError(404, "SERVICE_RECORD_NOT_FOUND", "Service record not found.");
  }
  return sc;
}

// ---------------------------------------------------------------------------
// Duplicate-active guard (override needs managerial role + reason)
// ---------------------------------------------------------------------------
export interface BridgeActor {
  userId: string;
  role?: string;
}

async function guardDuplicate(
  serviceRecordId: string,
  target: ServiceBridgeTarget,
  actor: BridgeActor,
  override: boolean | undefined,
  overrideReason: string | undefined,
): Promise<{ supersededId?: string; overrideReason?: string }> {
  const existing = await findActiveLink(serviceRecordId, target);
  if (!existing) return {};
  if (!override) {
    throw new ServiceBridgeError(
      409,
      "BRIDGE_EXISTS",
      `An active ${target.toUpperCase()} bridge already exists for this service record.`,
    );
  }
  if (!overrideReason || !overrideReason.trim()) {
    throw new ServiceBridgeError(
      400,
      "OVERRIDE_REASON_REQUIRED",
      "An override reason is required to replace an existing bridge.",
    );
  }
  if (!isManagerialRole(actor.role)) {
    throw new ServiceBridgeError(
      403,
      "OVERRIDE_FORBIDDEN",
      "You are not permitted to override an existing bridge.",
    );
  }
  return { supersededId: existing.id, overrideReason: overrideReason.trim() };
}

// ---------------------------------------------------------------------------
// Orchestrator input / output
// ---------------------------------------------------------------------------
export interface BridgeInput {
  /** service_customers.id (the source service record). */
  serviceRecordId?: string;
  override?: boolean;
  overrideReason?: string;
  /** Extra, schema-validated fields forwarded to the canonical creator. */
  payload?: Record<string, unknown>;
}

export interface BridgeResult {
  link: BridgeLink;
  target: unknown;
  supersededLinkId?: string;
}

async function recordBridgeAudit(
  target: ServiceBridgeTarget,
  link: BridgeLink,
  actor: BridgeActor,
  sc: ServiceCustomerRow,
  overrideReason: string | undefined,
  req?: Request,
): Promise<void> {
  try {
    await AuditLogService.record({
      actorUserId: actor.userId,
      actorRole: actor.role,
      action: `service_bridge.${target}.create`,
      module: "service",
      entityType: "service_bridge_link",
      entityId: link.id,
      reason: overrideReason,
      after: {
        serviceRecordId: sc.id,
        targetModule: target,
        targetRecordId: link.targetRecordId,
        customerId: sc.customerId,
      },
      req,
    });
  } catch (err) {
    console.error("[ServiceBridge] audit failed", err);
  }
}

async function notifyAccountsHod(message: string): Promise<void> {
  // Best-effort; notifyRole is a no-op for roles with no matching users.
  await NotificationService.notifyRole("accounts", message, "INFO", { targetUrl: "/service" });
  await NotificationService.notifyRole("hod", message, "INFO", { targetUrl: "/service" });
}

// ---------------------------------------------------------------------------
// BV bridge — real, via the canonical BV repository
// ---------------------------------------------------------------------------
export async function bridgeToBv(
  input: BridgeInput,
  actor: BridgeActor,
  req?: Request,
): Promise<BridgeResult> {
  const sc = await requireServiceCustomer(input.serviceRecordId);
  const guard = await guardDuplicate(sc.id, "bv", actor, input.override, input.overrideReason);

  // Canonical creation: same repository the BV route uses. customerId is taken
  // authoritatively from the service record (payload cannot override it).
  const report = await bvReportsRepository.create(actor.userId, {
    ...(input.payload ?? {}),
    customerId: sc.customerId,
  });

  if (guard.supersededId) await supersedeLink(guard.supersededId);
  const link = await createBridgeLink({
    serviceRecordId: sc.id,
    targetModule: "bv",
    targetRecordId: String(report.id),
    createdBy: actor.userId,
    overrideReason: guard.overrideReason ?? null,
    metadata: { sourceModule: "service", customerId: sc.customerId },
  });

  await recordBridgeAudit("bv", link, actor, sc, guard.overrideReason, req);
  await notifyAccountsHod("A BV report was created from a service record.");
  return { link, target: report, supersededLinkId: guard.supersededId };
}

// ---------------------------------------------------------------------------
// VAS bridge — real, via the canonical VAS repository
// ---------------------------------------------------------------------------
export async function bridgeToVas(
  input: BridgeInput,
  actor: BridgeActor,
  req?: Request,
): Promise<BridgeResult> {
  const sc = await requireServiceCustomer(input.serviceRecordId);
  const guard = await guardDuplicate(sc.id, "vas", actor, input.override, input.overrideReason);

  const report = await vasReportsRepository.create(actor.userId, {
    ...(input.payload ?? {}),
    customerId: sc.customerId,
  });

  if (guard.supersededId) await supersedeLink(guard.supersededId);
  const link = await createBridgeLink({
    serviceRecordId: sc.id,
    targetModule: "vas",
    targetRecordId: String((report as any).id),
    createdBy: actor.userId,
    overrideReason: guard.overrideReason ?? null,
    metadata: { sourceModule: "service", customerId: sc.customerId },
  });

  await recordBridgeAudit("vas", link, actor, sc, guard.overrideReason, req);
  await notifyAccountsHod("A VAS report was created from a service record.");
  return { link, target: report, supersededLinkId: guard.supersededId };
}

// ---------------------------------------------------------------------------
// GM bridge — link-only (GM creation stays in the canonical GM module)
// ---------------------------------------------------------------------------
export async function bridgeToGm(
  input: BridgeInput,
  actor: BridgeActor,
  req?: Request,
): Promise<BridgeResult> {
  const sc = await requireServiceCustomer(input.serviceRecordId);
  const guard = await guardDuplicate(sc.id, "gm", actor, input.override, input.overrideReason);

  // Optionally link to an EXISTING GM entry created in the GM module. We never
  // fork the GM financial creation pipeline here (see SERVICE_BRIDGE_DECISION.md).
  let targetRecordId: string | null = null;
  const gmId = (input.payload?.gmRecordId ?? input.payload?.gmId) as string | undefined;
  if (gmId && String(gmId).trim()) {
    const { rows } = await pool.query<{ id: string }>(
      `SELECT id FROM drm.gm_entries WHERE id = $1 LIMIT 1`,
      [String(gmId).trim()],
    );
    if (rows.length === 0) {
      throw new ServiceBridgeError(400, "INVALID_GM", "The referenced GM entry was not found.");
    }
    targetRecordId = String(rows[0].id);
  }

  if (guard.supersededId) await supersedeLink(guard.supersededId);
  const link = await createBridgeLink({
    serviceRecordId: sc.id,
    targetModule: "gm",
    targetRecordId,
    createdBy: actor.userId,
    overrideReason: guard.overrideReason ?? null,
    metadata: {
      sourceModule: "service",
      serviceRecordId: sc.id,
      customerId: sc.customerId,
      companyId: sc.companyId,
      packageId: sc.packageId,
      handoff: targetRecordId ? "linked" : "pending_gm_creation",
    },
  });

  await recordBridgeAudit("gm", link, actor, sc, guard.overrideReason, req);
  await notifyAccountsHod(
    targetRecordId
      ? "A service record was linked to a GM entry."
      : "A service record requested a GM entry (pending creation in the GM module).",
  );
  return { link, target: targetRecordId ? { id: targetRecordId } : null, supersededLinkId: guard.supersededId };
}

export const ServiceBridgeService = {
  ensureBridgeLinksTable,
  findActiveLink,
  listLinks,
  createBridgeLink,
  bridgeToGm,
  bridgeToVas,
  bridgeToBv,
  ServiceBridgeError,
  mapServiceBridgeError,
  TARGETS: SERVICE_BRIDGE_TARGETS,
};

export default ServiceBridgeService;
