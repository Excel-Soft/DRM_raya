import type { Express } from "express";
import { z } from "zod";
import { pool } from "./db";

const repeatOptions = ["HOUR", "DAILY", "WEEKLY", "MONTHLY", "YEARLY", "NONE"] as const;
const reminderOptions = ["same_day", "5m", "10m", "15m", "1d"] as const;
const priorityOptions = ["HIGH", "MEDIUM", "LOW"] as const;
const statusBuckets = ["assign", "unreceived", "received", "pending", "finished"] as const;
type StatusBucket = (typeof statusBuckets)[number];
const allowedStatuses = ["ASSIGNED", "UNRECEIVED", "RECEIVED", "PENDING", "FINISHED", "DONE", "COMPLETED"] as const;

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
  // Default pending bucket covers PENDING / OPEN / IN_PROGRESS / unknown.
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
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
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
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const { rows } = await pool.query(
        "select id, full_name from drm.users order by full_name asc limit 200",
      );
      return res.json(rows.map((r: any) => ({ id: r.id, name: r.full_name })));
    } catch (error) {
      console.error("Error fetching participants", error);
      return res.status(500).json({ error: "Failed to fetch participants" });
    }
  });

  // Create tasks (bulk)
  app.post("/api/attendance/todo", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const parsed = z.object({ items: z.array(todoItemSchema).min(1) }).parse(req.body);
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      console.error("[todo] Error creating todo tasks:", error);
      // Log more details about the error
      const pgError = error as any;
      return res.status(500).json({
        error: "Failed to create tasks",
        message: pgError.message,
        detail: pgError.detail,
        code: pgError.code
      });
    }
  });

  // List tasks for current user
  app.get("/api/attendance/todo", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
      const userId = req.user.userId;
      const role = req.user.roleId ?? "";
      const isAdmin = role === "admin";

      let query = `
        select id, title, category, description, priority, repeat, reminder, due_date, due_time, participants, status, created_at
          from drm.todo_tasks
      `;
      const params: any[] = [];

      if (!isAdmin) {
        query += ` where (created_by_user_id = $1::uuid OR $1::text = ANY(coalesce(participants, '{}')::text[])) `;
        params.push(userId);
      }

      query += ` order by due_date desc, created_at desc limit 100`;

      const { rows } = await pool.query(query, params);
      return res.json(rows);
    } catch (error) {
      console.error("[todo] Error fetching todo tasks:", error);
      return res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Update task status
  app.patch("/api/attendance/todo/:id/status", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
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
        return res.status(404).json({ error: "Task not found" });
      }
      const row = rows[0];
      const isOwner = row.created_by_user_id === req.user.userId;
      const participants: string[] = row.participants ?? [];
      const isParticipant = participants.includes(req.user.userId);

      if (!isAdmin && !isOwner && !isParticipant) {
        return res.status(403).json({ error: "Not allowed to update this task" });
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
        return res.status(400).json({ error: "Invalid status", details: error.errors });
      }
      console.error("Error updating todo status", error);
      return res.status(500).json({ error: "Failed to update status" });
    }
  });

  // Summary counts by status
  app.get("/api/attendance/todo/summary", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Not authenticated" });
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
      return res.status(500).json({ error: "Failed to fetch todo summary" });
    }
  });
}
