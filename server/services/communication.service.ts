import type { Request } from "express";
import { pool } from "../db";
import { ApiError } from "../utils/api-error";
import { AuditLogService } from "./audit-log.service";
import { NotificationService } from "./notification-service";
import type {
  CreateCommunication,
  PatchCommunication,
  CompleteNextAction,
  ListCommunications,
} from "../validators/communication.validators";

/**
 * CommunicationService — Stage 7.
 *
 * Owns the unified `drm.communication_logs` timeline (calls, WhatsApp, email,
 * meetings, visits, notes) plus the query-based reminder (due / overdue) queue.
 * All persistence is raw SQL against a runtime-ensured table because repo-wide
 * `db:push` is broken on a pre-existing FK mismatch (see ensureSchema()).
 *
 * Data-quality rules live in `communication.validators.ts`; this service adds
 * existence checks, reminder creation, and best-effort audit. The convenience
 * `log()` helper is intentionally NON-throwing so existing follow-up endpoints
 * can record a communication without any risk of breaking their own flow.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODULE = "communication";

export interface CommActor {
  userId?: string;
  roleId?: string;
  roles?: string[];
}

export interface CommunicationLogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  customer_id: string | null;
  lead_id: string | null;
  user_id: string | null;
  channel: string;
  outcome: string | null;
  notes: string | null;
  next_action: string | null;
  next_followup_at: string | null;
  status: string;
  related_followup_id: string | null;
  related_appointment_id: string | null;
  message_template: string | null;
  external_reference: string | null;
  created_at: string;
  updated_at: string;
}

let schemaEnsured = false;

export class CommunicationService {
  /** Idempotently create the enum types, table and indexes at runtime. */
  static async ensureSchema(): Promise<void> {
    if (schemaEnsured) return;
    try {
      await pool.query(`
        DO $$ BEGIN
          CREATE TYPE drm.communication_channel AS ENUM
            ('CALL','WHATSAPP','EMAIL','MEETING','VISIT','SMS','NOTE','OTHER');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
      await pool.query(`
        DO $$ BEGIN
          CREATE TYPE drm.communication_outcome AS ENUM
            ('INTERESTED','NOT_INTERESTED','CALLBACK','NO_RESPONSE','CONVERTED',
             'COMPLAINT','RENEWAL','RESOLVED','DROPOUT_RISK','OTHER');
        EXCEPTION WHEN duplicate_object THEN null; END $$;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS drm.communication_logs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_type text NOT NULL,
          entity_id text NOT NULL,
          customer_id uuid,
          lead_id uuid,
          user_id uuid,
          channel drm.communication_channel NOT NULL,
          outcome drm.communication_outcome,
          notes text,
          next_action text,
          next_followup_at timestamptz,
          status text NOT NULL DEFAULT 'COMPLETED',
          related_followup_id text,
          related_appointment_id text,
          message_template text,
          external_reference text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_comm_logs_entity
          ON drm.communication_logs (entity_type, entity_id);
        CREATE INDEX IF NOT EXISTS idx_comm_logs_customer
          ON drm.communication_logs (customer_id);
        CREATE INDEX IF NOT EXISTS idx_comm_logs_user
          ON drm.communication_logs (user_id);
        CREATE INDEX IF NOT EXISTS idx_comm_logs_followup_due
          ON drm.communication_logs (next_followup_at, status);
      `);
      schemaEnsured = true;
    } catch (err) {
      console.error("[CommunicationService] ensureSchema failed:", err);
      // leave schemaEnsured=false so the next call retries
    }
  }

  /** Verify a referenced customer exists (so logs never orphan-reference). */
  private static async assertCustomerExists(customerId?: string): Promise<void> {
    if (!customerId) return;
    const { rows } = await pool.query(
      `SELECT 1 FROM drm.customers WHERE id = $1 LIMIT 1`,
      [customerId],
    );
    if (rows.length === 0) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Referenced customer does not exist");
    }
  }

  /**
   * Create a communication log. Validation (channel/outcome/notes/next date
   * rules) is done by the caller via `createCommunicationSchema`. Creates a
   * reminder notification for the actor when a next follow-up is scheduled.
   */
  static async create(
    input: CreateCommunication,
    actor: CommActor,
    req?: Request,
  ): Promise<CommunicationLogRow> {
    await this.ensureSchema();
    await this.assertCustomerExists(input.customerId);

    const status = input.status ?? "COMPLETED";
    const actorId = actor.userId && UUID_RE.test(actor.userId) ? actor.userId : null;

    const { rows } = await pool.query(
      `INSERT INTO drm.communication_logs
        (entity_type, entity_id, customer_id, lead_id, user_id, channel, outcome,
         notes, next_action, next_followup_at, status, related_followup_id,
         related_appointment_id, message_template, external_reference)
       VALUES
        ($1,$2,$3,$4,$5,$6::drm.communication_channel,
         $7::drm.communication_outcome,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        input.entityType,
        input.entityId,
        input.customerId ?? null,
        input.leadId ?? null,
        actorId,
        input.channel,
        input.outcome ?? null,
        input.notes ?? null,
        input.nextAction ?? null,
        input.nextFollowupAt ?? null,
        status,
        input.relatedFollowupId ?? null,
        input.relatedAppointmentId ?? null,
        input.messageTemplate ?? null,
        input.externalReference ?? null,
      ],
    );

    const row = rows[0] as CommunicationLogRow;

    await this.afterWrite(row, actor, "communication.logged", req);
    return row;
  }

  /**
   * Best-effort logging used by existing follow-up endpoints (Task F). NEVER
   * throws — a logging failure must not break the host action.
   */
  static async log(
    input: CreateCommunication,
    actor: CommActor,
    req?: Request,
  ): Promise<CommunicationLogRow | null> {
    try {
      await this.ensureSchema();
      const status = input.status ?? "COMPLETED";
      const actorId = actor?.userId && UUID_RE.test(actor.userId) ? actor.userId : null;
      const { rows } = await pool.query(
        `INSERT INTO drm.communication_logs
          (entity_type, entity_id, customer_id, lead_id, user_id, channel, outcome,
           notes, next_action, next_followup_at, status, related_followup_id,
           related_appointment_id, message_template, external_reference)
         VALUES
          ($1,$2,$3,$4,$5,$6::drm.communication_channel,
           $7::drm.communication_outcome,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          input.entityType,
          input.entityId,
          input.customerId ?? null,
          input.leadId ?? null,
          actorId,
          input.channel,
          input.outcome ?? null,
          input.notes ?? null,
          input.nextAction ?? null,
          input.nextFollowupAt ?? null,
          status,
          input.relatedFollowupId ?? null,
          input.relatedAppointmentId ?? null,
          input.messageTemplate ?? null,
          input.externalReference ?? null,
        ],
      );
      const row = rows[0] as CommunicationLogRow;
      // fire-and-forget side effects
      void this.afterWrite(row, actor, "communication.logged", req);
      return row;
    } catch (err) {
      console.error("[CommunicationService] best-effort log failed:", err);
      return null;
    }
  }

  /** Reminder + audit side effects shared by create()/log(). Best-effort. */
  private static async afterWrite(
    row: CommunicationLogRow,
    actor: CommActor,
    action: string,
    req?: Request,
  ): Promise<void> {
    // Reminder: notify the actor of a scheduled future follow-up.
    if (row.next_followup_at && row.user_id && UUID_RE.test(row.user_id)) {
      await NotificationService.createNotification({
        userId: row.user_id,
        message: `Follow-up scheduled for ${row.entity_type} on ${new Date(
          row.next_followup_at,
        ).toLocaleString()}${row.next_action ? `: ${row.next_action}` : ""}`,
        type: "INFO",
        module: MODULE,
        entityType: row.entity_type,
        entityId: row.entity_id,
      });
    }
    await AuditLogService.record({
      actorUserId: actor.userId,
      action,
      module: MODULE,
      entityType: row.entity_type,
      entityId: row.entity_id,
      after: {
        channel: row.channel,
        outcome: row.outcome,
        status: row.status,
        nextFollowupAt: row.next_followup_at,
      },
      req,
    });
  }

  /** List communications with optional filters. */
  static async list(filters: ListCommunications): Promise<CommunicationLogRow[]> {
    await this.ensureSchema();
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, value: unknown) => {
      params.push(value);
      where.push(clause.replace("$?", `$${params.length}`));
    };

    if (filters.entityType) add("entity_type = $?", filters.entityType);
    if (filters.entityId) add("entity_id = $?", filters.entityId);
    if (filters.customerId) add("customer_id = $?", filters.customerId);
    if (filters.channel) add("channel = $?::drm.communication_channel", filters.channel);
    if (filters.outcome) add("outcome = $?::drm.communication_outcome", filters.outcome);
    if (filters.userId) add("user_id = $?", filters.userId);
    if (filters.status) add("status = $?", filters.status);
    if (filters.from) add("created_at >= $?", filters.from);
    if (filters.to) add("created_at <= $?", filters.to);

    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;
    params.push(limit, offset);

    const { rows } = await pool.query(
      `SELECT * FROM drm.communication_logs
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return rows as CommunicationLogRow[];
  }

  /** Full chronological timeline for one entity. */
  static async timeline(entityType: string, entityId: string): Promise<CommunicationLogRow[]> {
    await this.ensureSchema();
    const { rows } = await pool.query(
      `SELECT * FROM drm.communication_logs
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC`,
      [entityType, entityId],
    );
    return rows as CommunicationLogRow[];
  }

  private static async getById(id: string): Promise<CommunicationLogRow> {
    const { rows } = await pool.query(
      `SELECT * FROM drm.communication_logs WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) {
      throw new ApiError(404, "COMMUNICATION_NOT_FOUND", "Communication log not found");
    }
    return rows[0] as CommunicationLogRow;
  }

  /** Patch notes / next action / reschedule / status of a log. */
  static async patch(
    id: string,
    input: PatchCommunication,
    actor: CommActor,
    req?: Request,
  ): Promise<CommunicationLogRow> {
    await this.ensureSchema();
    const existing = await this.getById(id);

    const sets: string[] = [];
    const params: unknown[] = [];
    const setField = (col: string, value: unknown, cast = "") => {
      params.push(value);
      sets.push(`${col} = $${params.length}${cast}`);
    };

    if (input.outcome !== undefined) setField("outcome", input.outcome, "::drm.communication_outcome");
    if (input.notes !== undefined) setField("notes", input.notes);
    if (input.nextAction !== undefined) setField("next_action", input.nextAction);
    if (input.nextFollowupAt !== undefined) setField("next_followup_at", input.nextFollowupAt);
    if (input.status !== undefined) setField("status", input.status);
    if (input.messageTemplate !== undefined) setField("message_template", input.messageTemplate);
    if (input.externalReference !== undefined) setField("external_reference", input.externalReference);

    sets.push("updated_at = now()");
    params.push(id);

    const { rows } = await pool.query(
      `UPDATE drm.communication_logs SET ${sets.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    const row = rows[0] as CommunicationLogRow;

    await AuditLogService.record({
      actorUserId: actor.userId,
      action: "communication.updated",
      module: MODULE,
      entityType: row.entity_type,
      entityId: row.entity_id,
      previousStatus: existing.status,
      nextStatus: row.status,
      before: { status: existing.status, outcome: existing.outcome },
      after: { status: row.status, outcome: row.outcome },
      req,
    });
    return row;
  }

  /**
   * Complete a PENDING follow-up's next action: records the outcome and closes
   * it. Optionally schedules a further follow-up (a new linked log).
   */
  static async completeNextAction(
    id: string,
    input: CompleteNextAction,
    actor: CommActor,
    req?: Request,
  ): Promise<{ completed: CommunicationLogRow; scheduled: CommunicationLogRow | null }> {
    await this.ensureSchema();
    const existing = await this.getById(id);

    const { rows } = await pool.query(
      `UPDATE drm.communication_logs
       SET status = 'COMPLETED',
           outcome = $1::drm.communication_outcome,
           notes = COALESCE($2, notes),
           updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [input.outcome, input.notes ?? null, id],
    );
    const completed = rows[0] as CommunicationLogRow;

    await AuditLogService.record({
      actorUserId: actor.userId,
      action: "communication.next_action_completed",
      module: MODULE,
      entityType: completed.entity_type,
      entityId: completed.entity_id,
      previousStatus: existing.status,
      nextStatus: "COMPLETED",
      after: { outcome: completed.outcome },
      req,
    });

    // Optionally chain a new scheduled follow-up.
    let scheduled: CommunicationLogRow | null = null;
    if (input.nextFollowupAt) {
      scheduled = await this.log(
        {
          entityType: completed.entity_type as CreateCommunication["entityType"],
          entityId: completed.entity_id,
          customerId: completed.customer_id ?? undefined,
          leadId: completed.lead_id ?? undefined,
          channel: completed.channel as CreateCommunication["channel"],
          status: "PENDING",
          nextAction: input.nextAction,
          nextFollowupAt: input.nextFollowupAt,
        },
        actor,
        req,
      );
    }
    return { completed, scheduled };
  }

  /** Upcoming reminders (PENDING, due now or in the future). Optionally per-user. */
  static async remindersDue(userId?: string): Promise<CommunicationLogRow[]> {
    await this.ensureSchema();
    const params: unknown[] = [];
    let userClause = "";
    if (userId) {
      params.push(userId);
      userClause = ` AND user_id = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT * FROM drm.communication_logs
       WHERE status = 'PENDING' AND next_followup_at IS NOT NULL
         AND next_followup_at >= now()${userClause}
       ORDER BY next_followup_at ASC`,
      params,
    );
    return rows as CommunicationLogRow[];
  }

  /** Overdue reminders (PENDING, next follow-up date already passed). */
  static async remindersOverdue(userId?: string): Promise<CommunicationLogRow[]> {
    await this.ensureSchema();
    const params: unknown[] = [];
    let userClause = "";
    if (userId) {
      params.push(userId);
      userClause = ` AND user_id = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT * FROM drm.communication_logs
       WHERE status = 'PENDING' AND next_followup_at IS NOT NULL
         AND next_followup_at < now()${userClause}
       ORDER BY next_followup_at ASC`,
      params,
    );
    return rows as CommunicationLogRow[];
  }
}

export default CommunicationService;
