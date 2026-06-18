import type { Request } from "express";
import { recordAuditLog as recordAuditLogImpl, ActivityLogService } from "./activity-service";

/**
 * AuditLogService — canonical entry point for audit logging.
 *
 * It deliberately REUSES the existing `drm.activity_logs` table and the
 * `recordAuditLog` implementation in `activity-service.ts` (no new table, no
 * breaking schema change). The richer audit fields — `module`, `previousStatus`,
 * `nextStatus`, `before`, `after`, `reason`, plus request `ip`/`userAgent` — are
 * serialized into the `details` JSON column. Flat columns map as:
 *   actorUserId -> user_id, action -> action,
 *   entityType  -> resource_type, entityId -> resource_id.
 *
 * SECURITY: never pass secrets (password hashes, tokens) in `before`/`after`.
 * This service does not introspect or redact the payload.
 */

export interface AuditLogInput {
  actorUserId?: string;
  activeRole?: string;
  action: string;
  module?: string;
  entityType: string;
  entityId: string;
  previousStatus?: string;
  nextStatus?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  req?: Request;
}

export class AuditLogService {
  /** Record a single audit event. Best-effort: never throws to the caller. */
  static async record(input: AuditLogInput): Promise<void> {
    await recordAuditLogImpl(input);
  }

  /**
   * Convenience for status transitions (approvals, workflow moves). Captures
   * `previousStatus` / `nextStatus` explicitly so the audit trail is queryable.
   */
  static async recordTransition(input: {
    actorUserId?: string;
    action: string;
    module?: string;
    entityType: string;
    entityId: string;
    previousStatus?: string;
    nextStatus: string;
    reason?: string;
    before?: unknown;
    after?: unknown;
    req?: Request;
  }): Promise<void> {
    await recordAuditLogImpl(input);
  }

  /** Read audit history for a given entity (delegates to ActivityLogService). */
  static async getHistory(entityType: string, entityId: string) {
    return ActivityLogService.getLogsForResource(entityType, String(entityId));
  }
}

// Re-export the function form for call sites that prefer it.
export const recordAuditLog = recordAuditLogImpl;

export default AuditLogService;
