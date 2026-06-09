import type { Express } from "express";
import { z } from "zod";
import { pool } from "./db";
import { sendError, sendApiError, errorEnvelope, unauthorized, forbidden, notFound, ApiError } from "./utils/api-error";
import { ValidationService } from "./services/validation.service";

const repeatOptions = ["HOUR", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "NONE"] as const;
const reminderOptions = ["same_day", "5m", "10m", "15m", "1d"] as const;
const priorityOptions = ["HIGH", "MEDIUM", "LOW"] as const;
const statusBuckets = ["assign", "unreceived", "received", "pending", "finished"] as const;
type StatusBucket = (typeof statusBuckets)[number];
const allowedStatuses = ["ASSIGNED", "UNRECEIVED", "RECEIVED", "PENDING", "REOPENED", "FINISHED", "DONE", "COMPLETED"] as const;

// Canonical status mapping:
// ASSIGNED -> assign
// UNRECEIVED/UNRECEIVED -> unreceived
// RECEIVED -> received
// PENDING/OPEN/IN_PROGRESS -> pending
// FINISHED/DONE/COMPLETED -> finished
function mapStatusToBucket(raw?: string | null): StatusBucket {
  const s = (raw ?? "").toUpperCase();
  if (s === "ASSIGNED") return "assign";
  if (s === "UNRECEIVED" || s === "UN_RECEIVED" || s === "UNRECIEVED") return "unreceived";
  if (s === "RECEIVED") return "received";
  if (s === "FINISHED" || s === "DONE" || s === "COMPLETED") return "finished";
  // Default pending bucket covers PENDING / REOPENED / OPEN / IN_PROGRESS / unknown.
  return "pending";
}

const todoItemSchema = z.object({
  task: z.string().min(1),
  category: z.string().optional().nullable(),
  date: z.string().min(1),
  time: z.string().optional().nullable(),
  participants: z.array(z.string()).optional().default([]),
  priority: z.enum(priorityOptions),
  repeat: z.enum(repeatOptions),
  reminder: z.enum(reminderOptions),
  description: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
});

export function registerTodoRoutes(app: Express) {
  // Categories (static list)
  app.get("/api/attendance/todo/categories", (req, res) => {
    if (!req.user) return sendError(res, unauthorized("Not authenticated"));
    return res.json([
      "General",
      "HR",
      "Attendance",
      "Payroll",
      "Training",
      "Compliance",
    ]);
  });

  // Participants list (users)
  app.get("/api/attendance/todo/participants", async (req, res) => {
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const { rows } = await pool.query(
        "select id, full_name from drm.users order by full_name asc limit 200",
      );
      return res.json(rows.map((r: any) => ({ id: r.id, name: r.full_name })));
    } catch (error) {
      console.error("Error fetching participants", error);
      return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch participants"));
    }
  });

  // Create tasks (bulk)
  app.post("/api/attendance/todo", async (req, res) => {
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const parsed = ValidationService.parse(
        z.object({ items: z.array(todoItemSchema).min(1) }),
        req.body,
      );
      const userId = req.user.userId;

      const values: any[] = [];
      const placeholders: string[] = [];
      let i = 1;

      for (const item of parsed.items) {
        placeholders.push(
          `($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`,
        );
        const cleanParticipants = (item.participants || [])
          .filter(p => p && p.trim().length > 0)
          .map(p => p.trim());

        values.push(
          userId,
          item.task,
          item.category ?? null,
          item.description ?? null,
          item.priority,
          item.repeat,
          item.reminder,
          item.date,
          item.time && item.time.trim() ? item.time.trim() : null,
          cleanParticipants.length ? cleanParticipants : null,
          "ASSIGNED", // default bucket for new tasks
        );
      }

      const sql = `
        insert into drm.todo_tasks
          (created_by_user_id, title, category, description, priority, repeat, reminder, due_date, due_time, participants, status)
        values ${placeholders.join(",")}
        returning id
      `;

      const result = await pool.query(sql, values);
      return res.json({ success: true, created: result.rowCount });
    } catch (error) {
      if (error instanceof ApiError || error instanceof z.ZodError) {
        return sendError(res, error);
      }
      // Log full DB error details server-side only; do not leak PG message/detail/code to the client.
      console.error("[todo] Error creating todo tasks:", error);
      return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to create tasks"));
    }
  });

  // List tasks for current user
  app.get("/api/attendance/todo", async (req, res) => {
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const userId = req.user.userId;
      const role = req.user.roleId ?? "";
      const isAdmin = role === "admin";

      const clauses: string[] = [];
      const params: any[] = [];
      let p = 1;

      if (!isAdmin) {
        clauses.push(`(created_by_user_id = $${p}::uuid OR $${p}::text = ANY(coalesce(participants, '{}')::text[]))`);
        params.push(userId);
        p++;
      }

      // Optional server-side filters.
      const statusFilter = (req.query.status as string | undefined)?.toUpperCase();
      if (statusFilter && (allowedStatuses as readonly string[]).includes(statusFilter)) {
        clauses.push(`upper(status) = $${p++}`);
        params.push(statusFilter);
      }

      const participant = req.query.participant as string | undefined;
      if (participant && participant.trim()) {
        clauses.push(`$${p}::text = ANY(coalesce(participants, '{}')::text[])`);
        params.push(participant.trim());
        p++;
      }

      const category = req.query.category as string | undefined;
      if (category && category.trim()) {
        clauses.push(`category = $${p++}`);
        params.push(category.trim());
      }

      const priority = (req.query.priority as string | undefined)?.toUpperCase();
      if (priority && (priorityOptions as readonly string[]).includes(priority)) {
        clauses.push(`upper(priority) = $${p++}`);
        params.push(priority);
      }

      const fromParam = req.query.from as string | undefined;
      if (fromParam) {
        const d = new Date(fromParam);
        if (!isNaN(d.getTime())) {
          clauses.push(`due_date >= $${p++}`);
          params.push(d);
        }
      }
      const toParam = req.query.to as string | undefined;
      if (toParam) {
        const d = new Date(toParam);
        if (!isNaN(d.getTime())) {
          clauses.push(`due_date <= $${p++}`);
          params.push(d);
        }
      }

      // Pagination (defaults preserve prior behaviour: up to 100 rows).
      let limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit <= 0 || limit > 200) limit = 100;
      let offset = Number(req.query.offset);
      if (!Number.isInteger(offset) || offset < 0) offset = 0;

      const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const query = `
        select id, title, category, description, priority, repeat, reminder, due_date, due_time, participants, status, created_at
          from drm.todo_tasks
          ${whereSql}
          order by due_date desc, created_at desc
          limit $${p++} offset $${p++}
      `;
      params.push(limit, offset);

      const { rows } = await pool.query(query, params);
      return res.json(rows);
    } catch (error) {
      console.error("[todo] Error fetching todo tasks:", error);
      return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch tasks"));
    }
  });

  // Update task status
  app.patch("/api/attendance/todo/:id/status", async (req, res) => {
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const taskId = req.params.id;
      const parsed = z
        .object({
          status: z.enum(allowedStatuses),
        })
        .parse(req.body);

      const status = parsed.status.toUpperCase();
      const role = req.user.roleId ?? "";
      const isAdmin = role === "admin";

      // Only creator or participant (or admin) can update
      const { rows } = await pool.query(
        `select created_by_user_id, participants from drm.todo_tasks where id = $1 limit 1`,
        [taskId],
      );
      if (rows.length === 0) {
        return sendError(res, notFound("Task not found"));
      }
      const row = rows[0];
      const isOwner = row.created_by_user_id === req.user.userId;
      const participants: string[] = row.participants ?? [];
      const isParticipant = participants.includes(req.user.userId);

      if (!isAdmin && !isOwner && !isParticipant) {
        return sendError(res, forbidden("Not allowed to update this task"));
      }

      const updateRes = await pool.query(
        `update drm.todo_tasks
            set status = $1, updated_at = now()
          where id = $2
          returning id, title, category, description, priority, repeat, reminder, due_date, due_time, participants, status, created_at`,
        [status, taskId],
      );

      return res.json({ success: true, task: updateRes.rows[0] });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return sendError(res, error);
      }
      console.error("Error updating todo status", error);
      return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to update status"));
    }
  });

  // Summary counts by status
  app.get("/api/attendance/todo/summary", async (req, res) => {
    try {
      if (!req.user) return sendError(res, unauthorized("Not authenticated"));
      const role = req.user.roleId ?? "";
      const isAdmin = role === "admin";
      const userIdParam = (req.query.userId as string | undefined) ?? undefined;
      const fromParam = req.query.from as string | undefined;
      const toParam = req.query.to as string | undefined;

      const clauses: string[] = [];
      const params: any[] = [];
      let p = 1;

      if (!isAdmin) {
        clauses.push(`(created_by_user_id = $${p}::uuid OR $${p}::text = ANY(coalesce(participants, '{}')::text[]))`);
        params.push(req.user.userId);
        p++;
      } else if (userIdParam) {
        clauses.push(`(created_by_user_id = $${p}::uuid OR $${p}::text = ANY(coalesce(participants, '{}')::text[]))`);
        params.push(userIdParam);
        p++;
      }

      if (fromParam) {
        const d = new Date(fromParam);
        if (!isNaN(d.getTime())) {
          clauses.push(`due_date >= $${p++}`);
          params.push(d);
        }
      }
      if (toParam) {
        const d = new Date(toParam);
        if (!isNaN(d.getTime())) {
          clauses.push(`due_date <= $${p++}`);
          params.push(d);
        }
      }

      const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
      const sql = `select status, count(*)::int as count from drm.todo_tasks ${whereSql} group by status`;
      const { rows } = await pool.query(sql, params);

      const summary: Record<StatusBucket, number> = {
        assign: 0,
        unreceived: 0,
        received: 0,
        pending: 0,
        finished: 0,
      };

      for (const row of rows) {
        const bucket = mapStatusToBucket(row.status);
        summary[bucket] = (summary[bucket] ?? 0) + Number(row.count ?? 0);
      }

      return res.json(summary);
    } catch (error) {
      console.error("Error fetching todo summary", error);
      return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Failed to fetch todo summary"));
    }
  });
}
