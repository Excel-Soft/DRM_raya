import type { Express } from "express";
import { z } from "zod";
import { isManagerialRole, normalizeRole } from "./utils/role-utils";
import { pool, isDbAvailable, isNetworkOrDnsError, markDbUnavailable } from "./db";
import { authMiddleware } from "./auth.middleware";
import type { PoolClient } from "pg";

type DateRange = { from: Date; to: Date };

const summaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  branchId: z.string().optional(),
  bucket: z.enum(["daily", "weekly"]).default("daily").optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.string().optional(),
  status: z.string().optional(),
  threshold: z.coerce.number().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

function parseDateRange(query: { from?: string; to?: string }): DateRange {
  const now = new Date();
  const to = query.to ? new Date(query.to) : now;
  const from = query.from ? new Date(query.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

function getPeriodRange(periodRaw: string): DateRange {
  const period = periodRaw?.toUpperCase() || "WC";
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case "TD":
      return { from: startOfDay, to: new Date() };
    case "LD": {
      const yesterday = new Date(startOfDay);
      yesterday.setDate(startOfDay.getDate() - 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return { from: yesterday, to: yesterdayEnd };
    }
    case "MC":
    case "MONTH":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date() };
    case "LM":
      return { 
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1), 
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) 
      };
    case "ALL":
    case "OVERALL":
      return { from: new Date(0), to: new Date() };
    case "WC":
    default: {
      // Week starts on Monday
      const day = startOfDay.getDay();
      const diff = (day === 0 ? -6 : 1) - day;
      const monday = new Date(startOfDay);
      monday.setDate(startOfDay.getDate() + diff);
      return { from: monday, to: new Date() };
    }
  }
}

function sendValidationError(res: any, error: z.ZodError) {
  res.status(400).json({
    error: "BadRequest",
    message: "Invalid request parameters",
    details: error.errors,
  });
}

function isDbUnavailableError(err: any): boolean {
  const code = (err as any)?.code;
  return code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ENETUNREACH";
}

function respondDbUnavailable(res: any, fallback: unknown) {
  return res.status(503).json({
    success: false,
    message: "Database unavailable",
    data: fallback,
  });
}

type RetryableErrorCode = "ETIMEDOUT" | "ECONNRESET" | "EPIPE" | "ECONNREFUSED" | "57P01";
function isTransientDbError(err: any): boolean {
  const code = (err as any)?.code as RetryableErrorCode | undefined;
  if (!code) return false;
  return code === "ETIMEDOUT" || code === "ECONNRESET" || code === "EPIPE" || code === "ECONNREFUSED" || code === "57P01";
}

async function queryWithRetry<T = any>(
  client: PoolClient,
  sqlText: string,
  params: any[],
  maxAttempts = 3,
): Promise<{ rows: T[] }> {
  const backoff = [0, 250, 750];
  let lastError: any;
  for (let attempt = 0; attempt < Math.min(maxAttempts, backoff.length); attempt++) {
    if (backoff[attempt] > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoff[attempt]));
    }
    const start = Date.now();
    try {
      const result = await client.query(sqlText, params);
      const duration = Date.now() - start;
      console.info(`[db] query ok duration=${duration}ms rows=${result.rowCount ?? 0}`);
      return result;
    } catch (err) {
      lastError = err;
      const duration = Date.now() - start;
      console.error(`[db] query failed attempt=${attempt + 1} duration=${duration}ms code=${(err as any)?.code}`);
      if (!isTransientDbError(err) || attempt === maxAttempts - 1) {
        throw err;
      }
    }
  }
  throw lastError;
}

let ensureTablesPromise: Promise<void> | null = null;
async function ensureTables() {
  if (ensureTablesPromise) return ensureTablesPromise;
  ensureTablesPromise = (async () => {
    if (!isDbAvailable()) {
      console.warn("[dashboard] skipping ensure tables because database is unavailable");
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("set statement_timeout = 10000");

      await client.query(`
        create table if not exists products (
          id uuid primary key default gen_random_uuid(),
          name text not null,
          sku text not null,
          price numeric(12,2) not null default 0,
          cost numeric(12,2) not null default 0,
          stock int not null default 0,
          created_at timestamptz not null default now()
        );
      `);

      await client.query(`
        create table if not exists refunds (
          id uuid primary key default gen_random_uuid(),
          order_id uuid not null,
          amount numeric(12,2) not null,
          reason text,
          created_at timestamptz not null default now()
        );
      `);

      await client.query(`
        create table if not exists branches (
          id uuid primary key default gen_random_uuid(),
          name text not null unique
        );
      `);
    } finally {
      client.release();
    }
  })().catch(err => {
    ensureTablesPromise = null;
    throw err;
  });
  return ensureTablesPromise;
}

async function ensureTablesWithRetry() {
  const attempts = [500, 1000, 2000, 4000, 8000];
  for (let i = 0; i < attempts.length; i++) {
    try {
      await ensureTables();
      return;
    } catch (err) {
      const wait = attempts[i];
      console.error(`ensureTables attempt ${i + 1} failed:`, err);
      if (isNetworkOrDnsError(err)) {
        markDbUnavailable((err as any)?.message || "db unreachable", err);
        console.error("ensureTables giving up because database is unavailable");
        return;
      }
      if (i === attempts.length - 1) {
        console.error("ensureTables giving up after retries");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

function buildPagination(page = 1, pageSize = 10) {
  const limit = Math.max(1, Math.min(pageSize, 200));
  const offset = (Math.max(1, page) - 1) * limit;
  return { limit, offset };
}

function isManagerRole(roleId?: string | null) {
  return isManagerialRole(roleId);
}

export async function getDepartmentFilterUserIds(req: Express.Request | any): Promise<string[] | null> {
    const realRoleId = normalizeRole(req.user?.roleId);
    const activeRoleId = normalizeRole(req.user?.activeRoleId || req.user?.roleId);
    const isManager = isManagerRole(activeRoleId);
    const isGlobalAdminActive = ["admin", "super_admin", "super_hod", "hod", "account_manager"].includes(activeRoleId);
    const isFundamentallyAdmin = ["admin", "super_admin", "super_hod", "hod", "account_manager"].includes(realRoleId);

    // If active role is a global admin, return null (meaning NO FILTER, show all)
    if (isGlobalAdminActive) {
        return null;
    }

    if (isManager) {
        // Special case: Admin using Role Switcher to simulate a manager
        if (isFundamentallyAdmin && activeRoleId !== realRoleId) {
            let targetRoles: string[] = [activeRoleId];
            if (activeRoleId.endsWith("_manager")) {
                targetRoles.push(activeRoleId.replace("_manager", "_executive"));
                targetRoles.push(activeRoleId.replace("_manager", "_assistant_manager"));
            } else if (activeRoleId.endsWith("_assistant_manager")) {
                targetRoles.push(activeRoleId.replace("_assistant_manager", "_executive"));
            }
            
            const { rows } = await pool.query(
                `SELECT id FROM drm.users WHERE role = ANY($1)`,
                [targetRoles]
            );
            const allowedUserIds = rows.map(r => String(r.id));
            return allowedUserIds.length > 0 ? allowedUserIds : ['00000000-0000-0000-0000-000000000000'];
        }

        // Normal case: A real manager logging in (or an admin actually bound to users)
        const { rows } = await pool.query(
            `SELECT id FROM drm.users WHERE under_works = $1::text OR id = $1::uuid`,
            [req.user.userId]
        );
        const allowedUserIds = rows.map(r => String(r.id));
        allowedUserIds.push(String(req.user.userId)); // Always include the manager themselves
        return allowedUserIds.length > 0 ? allowedUserIds : [req.user.userId];
    }
    return null;
}

export function registerDashboardRoutes(app: Express) {
  app.use("/api/dashboard", authMiddleware);
  app.use("/api/orders", authMiddleware);
  app.use("/api/customers", authMiddleware);
  app.use("/api/products", authMiddleware);

  // Ensure tables once per process start.
  ensureTablesWithRetry().catch((err) => console.error("Failed to ensure analytics tables", err));

  // Summary KPIs
  app.get("/api/dashboard/summary", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });

      const period = String(req.query.period ?? "MONTH").toUpperCase();
      const { from, to } = getPeriodRange(period);
      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));
      const userId = req.user.userId;
      const allowedUserIds = await getDepartmentFilterUserIds(req);

      // Revenue from GM Entries (Approved)
      const gmParams: any[] = [from, to];
      let gmFilter = "";
      if (!isManager) {
        gmFilter = ` and created_by::text = $${gmParams.length + 1}::text`;
        gmParams.push(userId);
      } else if (allowedUserIds) {
        gmFilter = ` and created_by::text = ANY($${gmParams.length + 1}::text[])`;
        gmParams.push(allowedUserIds);
      }
      const gmRes = await pool.query(
        `
          select coalesce(sum(amount_usd),0)::float as amount, count(*)::int as count
          from drm.gm_entries
          where coalesce(is_deleted,false)=false
            and (
              lower(status) = 'approved'
              or lower(final_status) = 'approved'
              or lower(payment_status) = 'approved'
              or lower(coalesce(approval_status,'')) in ('approved', 'approved_by_account')
              or lower(coalesce(hod_status,'')) = 'approved'
            )
            and created_at between $1 and $2
            ${gmFilter}
        `,
        gmParams,
      );
      const totalAmount = Number(gmRes.rows[0]?.amount ?? 0);
      const totalOpCount = Number(gmRes.rows[0]?.count ?? 0);

      // Customer status counts + revenue attribution (leads added)
      const customerParams: any[] = [from, to];
      let customerFilter = "";
      if (!isManager) {
        customerFilter = ` and coalesce(c.owner_user_id::text, c.created_by::text) = $${customerParams.length + 1}::text`;
        customerParams.push(userId);
      } else if (allowedUserIds) {
        customerFilter = ` and coalesce(c.owner_user_id::text, c.created_by::text) = ANY($${customerParams.length + 1}::text[])`;
        customerParams.push(allowedUserIds);
      }
      const statusRes = await pool.query(
        `
          select c.status, count(*)::int as count, coalesce(sum(op.value),0)::float as amount
            from drm.customers c
            left join drm.opportunities op on op.customer_id::text = c.id::text and coalesce(op.is_deleted,false)=false
           where c.created_at between $1 and $2
             ${customerFilter}
           group by c.status
        `,
        customerParams,
      );
      const statusMap = statusRes.rows.reduce<Record<string, { count: number; amount: number }>>((acc, row) => {
        acc[String(row.status)] = {
          count: Number(row.count ?? 0),
          amount: Number(row.amount ?? 0),
        };
        return acc;
      }, {});

      // Service type derived KPIs (VM / KWA / PSA / Sponsor)
      const serviceRes = await pool.query(
        `
          select lower(svc.service_value) as service, count(*)::int as count, coalesce(sum(op.value),0)::float as amount
            from drm.customers c
            left join drm.opportunities op on op.customer_id::text = c.id::text and coalesce(op.is_deleted,false)=false
            cross join lateral unnest(coalesce(c.service_types, '{}'::text[])) as svc(service_value)
           where c.created_at between $1 and $2
             ${customerFilter}
           group by lower(svc.service_value)
        `,
        customerParams,
      );

      const pickService = (keys: string[]) => {
        const row = serviceRes.rows.find((r) => keys.some((k) => (r.service as string)?.includes(k)));
        return {
          count: Number(row?.count ?? 0),
          amount: Number(row?.amount ?? 0),
        };
      };

      res.json({
        success: true,
        data: {
          totalRevenue: { count: totalOpCount, amount: totalAmount },
          new: statusMap["New"] ?? { count: 0, amount: 0 },
          renew: statusMap["Renew"] ?? { count: 0, amount: 0 },
          expire: statusMap["Expire"] ?? { count: 0, amount: 0 },
          vm: pickService(["vm"]),
          kwa: pickService(["kwa"]),
          psa: pickService(["psa"]),
          sponsorBrand: pickService(["sponsor", "brand"]),
        },
        meta: {
          period,
          from: from.toISOString(),
          to: to.toISOString(),
          scope: isManager ? "manager" : "self",
        },
      });
    } catch (err) {
      console.error("Error fetching dashboard summary", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch summary" });
    }
  });

  // Revenue series
  app.get("/api/dashboard/revenue-series", async (req, res) => {
    try {
      const parsed = summaryQuerySchema.parse(req.query);
      const { from, to } = parseDateRange(parsed);
      const bucket = parsed.bucket ?? "daily";
      const region = parsed.branchId || null;
      const trunc = bucket === "weekly" ? "week" : "day";

      const sql = `
        select date_trunc('${trunc}', op.created_at) as bucket,
               coalesce(sum(op.value),0)::float as revenue
        from drm.opportunities op
        inner join drm.customers c on c.id = op.customer_id
        where op.created_at between $1 and $2
          ${region ? "and c.region = $3" : ""}
          and coalesce(op.is_deleted,false) = false
        group by 1
        order by 1 asc
      `;
      const params = region ? [from, to, region] : [from, to];
      const result = await pool.query(sql, params);
      res.json(result.rows.map((r: any) => ({ date: r.bucket, revenue: Number(r.revenue) })));
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error fetching revenue series", err);
      if (isDbUnavailableError(err)) return respondDbUnavailable(res, []);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch revenue series" });
    }
  });

  // Orders series (counts)
  app.get("/api/dashboard/orders-series", async (req, res) => {
    try {
      const parsed = summaryQuerySchema.parse(req.query);
      const { from, to } = parseDateRange(parsed);
      const bucket = parsed.bucket ?? "daily";
      const region = parsed.branchId || null;
      const trunc = bucket === "weekly" ? "week" : "day";

      const sql = `
        select date_trunc('${trunc}', op.created_at) as bucket,
               count(*)::int as orders
        from drm.opportunities op
        inner join drm.customers c on c.id = op.customer_id
        where op.created_at between $1 and $2
          ${region ? "and c.region = $3" : ""}
          and coalesce(op.is_deleted,false) = false
        group by 1
        order by 1 asc
      `;
      const params = region ? [from, to, region] : [from, to];
      const result = await pool.query(sql, params);
      res.json(result.rows.map((r: any) => ({ date: r.bucket, orders: Number(r.orders) })));
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error fetching orders series", err);
      if (isDbUnavailableError(err)) return respondDbUnavailable(res, []);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch orders series" });
    }
  });

  // Top products (using opportunity.title as proxy)
  app.get("/api/dashboard/top-products", async (req, res) => {
    try {
      const parsed = summaryQuerySchema.parse(req.query);
      const { from, to } = parseDateRange(parsed);
      const limit = parsed.limit ?? 10;
      const region = parsed.branchId || null;

      const sql = `
        select coalesce(op.title,'Unnamed') as product,
               coalesce(sum(op.value),0)::float as revenue
        from drm.opportunities op
        inner join drm.customers c on c.id = op.customer_id
        where op.created_at between $1 and $2
          ${region ? "and c.region = $3" : ""}
          and coalesce(op.is_deleted,false) = false
        group by 1
        order by revenue desc
        limit $${region ? 4 : 3}
      `;
      const params = region ? [from, to, region, limit] : [from, to, limit];
      const result = await pool.query(sql, params);
      res.json(result.rows.map((r: any) => ({ name: r.product, revenue: Number(r.revenue) })));
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error fetching top products", err);
      if (isDbUnavailableError(err)) return respondDbUnavailable(res, []);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch top products" });
    }
  });

  // Sales by channel (customer source)
  app.get("/api/dashboard/sales-by-channel", async (req, res) => {
    try {
      const parsed = summaryQuerySchema.parse(req.query);
      const { from, to } = parseDateRange(parsed);
      const region = parsed.branchId || null;

      const sql = `
        select coalesce(c.source, 'Unknown') as channel,
               count(*)::int as orders,
               coalesce(sum(op.value),0)::float as revenue
        from drm.opportunities op
        inner join drm.customers c on c.id = op.customer_id
        where op.created_at between $1 and $2
          ${region ? "and c.region = $3" : ""}
          and coalesce(op.is_deleted,false) = false
        group by 1
        order by revenue desc
      `;
      const params = region ? [from, to, region] : [from, to];
      const result = await pool.query(sql, params);
      res.json(result.rows.map((r: any) => ({
        channel: r.channel,
        orders: Number(r.orders),
        revenue: Number(r.revenue),
      })));
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error fetching sales by channel", err);
      if (isDbUnavailableError(err)) return respondDbUnavailable(res, []);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch sales by channel" });
    }
  });

  // Dashboard activities table (methods + meetings)
  app.get("/api/dashboard/activities", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      const period = String(req.query.period ?? "TD").toUpperCase();
      let from: Date, to: Date;
      if (req.query.from && req.query.to) {
          from = new Date(req.query.from as string);
          to = new Date(req.query.to as string);
          to.setHours(23, 59, 59, 999);
      } else {
          const range = getPeriodRange(period);
          from = range.from;
          to = range.to;
      }
      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));
      const userId = req.user.userId;
      const allowedUserIds = await getDepartmentFilterUserIds(req);

      const activityParams: any[] = [from, to];
      let activityFilter = "";
      if (!isManager) {
        activityFilter = ` and a.created_by = $${activityParams.length + 1}::uuid`;
        activityParams.push(userId);
      } else if (allowedUserIds) {
        activityFilter = ` and a.created_by = ANY($${activityParams.length + 1}::uuid[])`;
        activityParams.push(allowedUserIds);
      }
      const activityRows = await pool.query(
        `
          select a.created_by as user_id,
                 coalesce(u.full_name, u.name, u.username) as name,
                 count(*) filter (where lower(a.type::text)='mobile')::int as mobile,
                 count(*) filter (where lower(a.type::text)='whatsapp')::int as whatsapp,
                 count(*) filter (where lower(a.type::text)='onsite')::int as onsite,
                 count(*) filter (where lower(a.type::text)='email')::int as email,
                 count(*) filter (where lower(a.type::text)='seminar')::int as seminar,
                 count(*) filter (where lower(a.type::text)='webinar')::int as webinar,
                 count(*)::int as total
            from drm.activities a
            left join drm.users u on u.id = a.created_by
           where coalesce(a.activity_date, a.created_at) between $1 and $2
             ${activityFilter}
           group by a.created_by, u.full_name, u.name, u.username
           order by name nulls last
        `,
        activityParams,
      );

      const apptParams: any[] = [from, to];
      let apptFilter = "";
      if (!isManager) {
        apptFilter = ` and ap.assigned_to = $${apptParams.length + 1}::uuid`;
        apptParams.push(userId);
      } else if (allowedUserIds) {
        apptFilter = ` and ap.assigned_to = ANY($${apptParams.length + 1}::uuid[])`;
        apptParams.push(allowedUserIds);
      }
      const apptRows = await pool.query(
        `
          select ap.assigned_to::text as user_id,
                 count(*)::int as appointments,
                 coalesce(sum(extract(epoch from (ap.ends_at - ap.starts_at)) / 60),0)::float as total_minutes
            from drm.appointments ap
           where coalesce(ap.is_deleted,false)=false
             and ap.starts_at between $1 and $2
             ${apptFilter}
           group by ap.assigned_to
        `,
        apptParams,
      );

      const customerParams: any[] = [from, to];
      let customerFilter = "";
      if (!isManager) {
        customerFilter = ` and coalesce(c.owner_user_id::text, c.created_by::text) = $${customerParams.length + 1}::text`;
        customerParams.push(userId);
      }
      const gradeRows = await pool.query(
        `
          select coalesce(c.owner_user_id, c.created_by)::text as user_id, c.grade, count(*)::int as count
            from drm.customers c
           where c.created_at between $1 and $2
             ${customerFilter}
           group by coalesce(c.owner_user_id, c.created_by), c.grade
        `,
        customerParams,
      );

      const apptMap = apptRows.rows.reduce<Record<string, { appointments: number; totalMinutes: number }>>((acc, row) => {
        const key = row.user_id ?? "unknown";
        acc[key] = {
          appointments: Number(row.appointments ?? 0),
          totalMinutes: Number(row.total_minutes ?? 0),
        };
        return acc;
      }, {});

      const gradeMap = gradeRows.rows.reduce<Record<string, { aMinus: number; bPlus: number }>>((acc, row) => {
        const key = row.user_id ?? "unknown";
        if (!acc[key]) acc[key] = { aMinus: 0, bPlus: 0 };
        if (row.grade === "A-") acc[key].aMinus += Number(row.count ?? 0);
        if (row.grade === "B+") acc[key].bPlus += Number(row.count ?? 0);
        return acc;
      }, {});

      const defaultTargets = {
        mobile: 50,
        whatsapp: 20,
        onsite: 1,
        email: 50,
        seminar: 1,
        webinar: 1,
        appointment: 3,
        meeting: 2,
        aMinus: 6,
        bPlus: 13,
        copy: 90,
        new: 10,
      };

      // Scale targets by the number of days in the selected period (minimum 1)
      const dayDiff = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 3600 * 24)));
      if (dayDiff > 1) {
        for (const key of Object.keys(defaultTargets)) {
          (defaultTargets as any)[key] = (defaultTargets as any)[key] * dayDiff;
        }
      }

      // Fetch dynamic targets from DB to override default targets based on role
      let allDailyTargets: any[] = [];
      try {
        const targetRes = await pool.query(`SELECT * FROM drm.target_system_daily_targets`);
        allDailyTargets = targetRes.rows;
      } catch (err) {
        console.error("Failed to fetch daily targets for dashboard", err);
      }

      // We need a way to look up roles for each user
      let displayUsers: any[] = [];
      if (isManager && allowedUserIds) {
          const uRes = await pool.query(`SELECT id::text as user_id, coalesce(full_name, name, username) as name, role FROM drm.users WHERE id = ANY($1::uuid[])`, [allowedUserIds]);
          displayUsers = uRes.rows;
      } else {
          const uRes = await pool.query(`SELECT id::text as user_id, coalesce(full_name, name, username) as name, role FROM drm.users WHERE id = $1::uuid`, [userId]);
          displayUsers = uRes.rows;
      }

      const activityMap = activityRows.rows.reduce<Record<string, any>>((acc, row) => {
          if (row.user_id) acc[row.user_id] = row;
          return acc;
      }, {});

      // Fetch task time logs
      let taskTimeMap: Record<string, number> = {};
      try {
        const taskTimeParams: any[] = [from, to];
        let taskTimeFilter = "";
        if (!isManager) {
          taskTimeFilter = ` and ttl.user_id = $3::uuid`;
          taskTimeParams.push(userId);
        } else if (allowedUserIds) {
          taskTimeFilter = ` and ttl.user_id = ANY($3::uuid[])`;
          taskTimeParams.push(allowedUserIds);
        }

        const taskTimeQuery = `
          SELECT 
            ttl.user_id::text as user_id,
            COALESCE(SUM(ttl.time_spent_minutes), 0)::float as total_minutes
          FROM drm.task_time_logs ttl
          WHERE ttl.log_date BETWEEN $1 AND $2
            ${taskTimeFilter}
          GROUP BY ttl.user_id
        `;
        const taskTimeRes = await pool.query(taskTimeQuery, taskTimeParams);
        taskTimeMap = taskTimeRes.rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.user_id] = Number(row.total_minutes || 0);
          return acc;
        }, {});
      } catch (err) {
        console.error("Failed to fetch task time logs for dashboard activities", err);
      }

      // Fetch product posting evidence links counts
      let ppEvidenceMap: Record<string, { copy: number; new: number }> = {};
      try {
        const ppEvidenceParams: any[] = [from, to];
        let ppEvidenceFilter = "";
        if (!isManager) {
          ppEvidenceFilter = ` and el.created_by_user_id = $3::uuid`;
          ppEvidenceParams.push(userId);
        } else if (allowedUserIds) {
          ppEvidenceFilter = ` and el.created_by_user_id = ANY($3::uuid[])`;
          ppEvidenceParams.push(allowedUserIds);
        }

        const ppEvidenceQuery = `
          SELECT 
            el.created_by_user_id::text as user_id,
            COUNT(*) filter (where lower(t.title) LIKE '%copy%' or lower(p.name) LIKE '%copy%')::int as copy_count,
            COUNT(*) filter (where not (lower(t.title) LIKE '%copy%' or lower(p.name) LIKE '%copy%') or t.title is null)::int as new_count
          FROM drm.product_posting_evidence_links el
          LEFT JOIN drm.tasks t ON el.task_id = t.id
          LEFT JOIN drm.projects p ON el.project_id = p.id
          WHERE el.created_at BETWEEN $1 AND $2
            ${ppEvidenceFilter}
          GROUP BY el.created_by_user_id
        `;
        const ppEvidenceRes = await pool.query(ppEvidenceQuery, ppEvidenceParams);
        ppEvidenceMap = ppEvidenceRes.rows.reduce<Record<string, { copy: number; new: number }>>((acc, row) => {
          acc[row.user_id] = {
            copy: Number(row.copy_count || 0),
            new: Number(row.new_count || 0),
          };
          return acc;
        }, {});
      } catch (err) {
        console.error("Failed to fetch product posting evidence links for dashboard activities", err);
      }

      const rows = displayUsers.map((uRow) => {
        const key = uRow.user_id;
        const row = activityMap[key] || {};
        const appt = apptMap[key] ?? { appointments: 0, totalMinutes: 0 };
        const grades = gradeMap[key] ?? { aMinus: 0, bPlus: 0 };
        const taskTimeMinutes = taskTimeMap[key] || 0;
        const ppEvidence = ppEvidenceMap[key] ?? { copy: 0, new: 0 };
        
        // Clone default targets for this user
        const userTargets = { ...defaultTargets };
        
        // Override with role-specific dynamic targets if available
        const userRole = (uRow.role || "").toLowerCase().replace(/_/g, ' ');
        if (userRole && allDailyTargets.length > 0) {
            const roleTargets = allDailyTargets.filter(t => (t.role || "").toLowerCase() === userRole);
            roleTargets.forEach(t => {
                const normMethod = (t.method || "").toLowerCase().replace(/[^a-z0-9]/g, '_');
                const targetVal = Number(t.target) || 0;
                if (normMethod.includes('mobile')) userTargets.mobile = targetVal;
                if (normMethod.includes('whatsapp')) userTargets.whatsapp = targetVal;
                if (normMethod.includes('email')) userTargets.email = targetVal;
                if (normMethod.includes('seminar')) userTargets.seminar = targetVal;
                if (normMethod.includes('webinar')) userTargets.webinar = targetVal;
                if (normMethod.includes('appointment')) userTargets.appointment = targetVal;
                if (normMethod.includes('meeting')) {
                    userTargets.meeting = targetVal;
                    if (normMethod.includes('out') || normMethod.includes('site')) userTargets.onsite = targetVal;
                }
                if (normMethod.includes('copy')) (userTargets as any).copy = targetVal;
                if (normMethod.includes('new')) (userTargets as any).new = targetVal;
            });
        }

        const isProductPosting = userRole.includes("posting") || userRole.includes("product posting");
        const userTimeMinutes = isProductPosting ? taskTimeMinutes : appt.totalMinutes;

        const methods: any = {
          mobile: { done: Number(row.mobile ?? 0), target: userTargets.mobile },
          whatsapp: { done: Number(row.whatsapp ?? 0), target: userTargets.whatsapp },
          onsite: { done: Number(row.onsite ?? 0), target: userTargets.onsite },
          email: { done: Number(row.email ?? 0), target: userTargets.email },
          seminar: { done: Number(row.seminar ?? 0), target: userTargets.seminar },
          webinar: { done: Number(row.webinar ?? 0), target: userTargets.webinar },
          appointment: { done: appt.appointments, target: userTargets.appointment },
          meeting: { done: appt.appointments, target: userTargets.meeting },
          aMinus: { done: grades.aMinus, target: userTargets.aMinus },
          bPlus: { done: grades.bPlus, target: userTargets.bPlus },
        };

        if (isProductPosting) {
          methods.copy = { done: ppEvidence.copy, target: userTargets.copy };
          methods.new = { done: ppEvidence.new, target: userTargets.new };
        }

        return {
          userId: key,
          name: uRow.name ?? "Unknown",
          methods,
          totals: {
            activities: isProductPosting ? (ppEvidence.copy + ppEvidence.new) : Number(row.total ?? 0),
            timeMinutes: Math.round(userTimeMinutes ?? 0),
          },
        };
      });

      const totals = rows.reduce(
        (acc, r) => {
          acc.activities += r.totals.activities;
          acc.timeMinutes += r.totals.timeMinutes;
          return acc;
        },
        { activities: 0, timeMinutes: 0 },
      );

      res.json({
        success: true,
        data: {
          period,
          from: from.toISOString(),
          to: to.toISOString(),
          rows: rows,
          totals,
        },
      });
    } catch (err) {
      console.error("Error fetching dashboard activities", err);
      if (isDbUnavailableError(err)) return respondDbUnavailable(res, []);
      res.status(500).json({ success: false, message: "Failed to fetch activities" });
    }
  });

  // Current month trend (counts + revenue by day)
  app.get("/api/dashboard/current-month-trend", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));

      const params: any[] = [from, to];
      let filter = "";
      if (!isManager) {
        filter = ` and op.owner_id::text = $${params.length + 1}::text`;
        params.push(req.user.userId);
      }

      const rows = await pool.query(
        `
          select date_trunc('day', op.created_at) as bucket,
                 count(*)::int as count,
                 coalesce(sum(op.value),0)::float as revenue
            from drm.opportunities op
           where coalesce(op.is_deleted,false)=false
             and op.created_at >= $1 and op.created_at < $2
             ${filter}
           group by 1
           order by 1 asc
        `,
        params,
      );

      res.json({
        success: true,
        data: {
          labels: rows.rows.map((r) => r.bucket),
          counts: rows.rows.map((r) => Number(r.count ?? 0)),
          revenue: rows.rows.map((r) => Number(r.revenue ?? 0)),
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });
    } catch (err) {
      console.error("Error fetching current month trend", err);
      if (isDbUnavailableError(err)) return respondDbUnavailable(res, []);
      res.status(500).json({ success: false, message: "Failed to fetch current month trend" });
    }
  });

  // Daily team meeting list
  app.get("/api/dashboard/daily-team-meeting", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      let from: Date;
      if (req.query.date) {
        const [y, m, d] = String(req.query.date).split("-").map(Number);
        from = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else {
        from = new Date();
        from.setHours(0, 0, 0, 0);
      }
      const to = new Date(from);
      to.setDate(from.getDate() + 1);
      const params: any[] = [from, to, req.user.userId];
      const filter = ` and m.created_by = $3::uuid`;

      const rows = await pool.query(
        `
          select m.id,
                 m.start_time as starts_at,
                 m.end_time as ends_at,
                 'N/A' as location,
                 m.notes as notes,
                 m.user_id,
                 coalesce(u.full_name, u.name, u.username) as user_name,
                 u.email
            from drm.meetings m
            left join drm.users u on u.id = m.user_id
           where m.start_time >= $1
             and m.start_time < $2
             and m.meeting_type = 'Team Meeting'
             ${filter}
           order by m.start_time desc
        `,
        params,
      );

      const items = rows.rows.map((r) => {
        const start = r.starts_at ? new Date(r.starts_at) : null;
        const end = r.ends_at ? new Date(r.ends_at) : null;
        const minutes =
          start && end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)) : null;
        return {
          id: r.id,
          userId: r.user_id,
          userName: r.user_name ?? "Unknown",
          email: r.email ?? null,
          startsAt: r.starts_at,
          endsAt: r.ends_at,
          location: r.location,
          notes: r.notes,
          totalMinutes: minutes,
        };
      });

      res.json({
        success: true,
        data: {
          items,
          date: from.toISOString(),
        },
      });
    } catch (err) {
      console.error("Error fetching daily team meeting", err);
      if (isDbUnavailableError(err)) return respondDbUnavailable(res, []);
      res.status(500).json({ success: false, message: "Failed to fetch daily team meeting" });
    }
  });

  app.post("/api/dashboard/team-meetings/:userId/start", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      const targetUserId = req.params.userId;
      
      const userRes = await pool.query("select coalesce(full_name, name, username) as name from drm.users where id = $1::uuid", [targetUserId]);
      const personName = userRes.rowCount && userRes.rowCount > 0 ? userRes.rows[0].name : "Unknown User";

      await pool.query(
        `insert into drm.meetings (user_id, person_name, meeting_type, start_time, status, created_by)
         values ($1::uuid, $2, 'Team Meeting', now(), 'in_progress', $3::uuid)`,
        [targetUserId, personName, req.user.userId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Error starting team meeting", err);
      res.status(500).json({ success: false, message: "Failed to start meeting" });
    }
  });

  app.post("/api/dashboard/team-meetings/:userId/end", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      const targetUserId = req.params.userId;
      const { comment } = req.body;

      await pool.query(
        `update drm.meetings 
            set status = 'ended', 
                end_time = now(), 
                total_duration_seconds = extract(epoch from (now() - start_time))::int,
                notes = $1 
          where user_id = $2::uuid 
            and meeting_type = 'Team Meeting' 
            and status = 'in_progress'`,
        [comment || null, targetUserId]
      );
      res.json({ success: true });
    } catch (err) {
      console.error("Error ending team meeting", err);
      res.status(500).json({ success: false, message: "Failed to end meeting" });
    }
  });

  app.get("/api/dashboard/team-meetings/active", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      const activeMeetings = await pool.query(
        `select user_id, start_time from drm.meetings where meeting_type = 'Team Meeting' and status = 'in_progress' and created_by = $1::uuid`,
        [req.user.userId]
      );
      const activeMap: Record<string, { startTime: Date }> = {};
      for (const row of activeMeetings.rows) {
        activeMap[row.user_id] = { startTime: row.start_time };
      }
      res.json({ success: true, data: activeMap });
    } catch (err) {
      console.error("Error fetching active team meetings", err);
      res.status(500).json({ success: false, message: "Failed to fetch active meetings" });
    }
  });

  // Team queue performance
  app.get("/api/dashboard/team-queue-performance", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      const period = String(req.query.period ?? "MONTH").toUpperCase();
      const { from, to } = getPeriodRange(period === "MONTH" ? "MONTH" : period);
      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));

      const allowedUserIds = await getDepartmentFilterUserIds(req);
      const params: any[] = [from, to];
      let filter = "";
      if (!isManager) {
        filter = ` and u.id::text = $${params.length + 1}::text`;
        params.push(req.user.userId);
      } else if (allowedUserIds) {
        filter = ` and u.id::uuid = ANY($${params.length + 1}::uuid[])`;
        params.push(allowedUserIds);
      }

      const client = await pool.connect();
      const routeStart = Date.now();
      try {
        await client.query("set statement_timeout = 8000");
        const sqlText = `
          select u.id::text as user_id,
                 coalesce(u.full_name, u.name, u.username) as name,
                 count(distinct op.id)::int as total_ops,
                 coalesce(sum(case when (lower(g.status) = 'approved' or lower(g.final_status) = 'approved' or lower(g.payment_status) = 'approved') then g.amount_usd else 0 end), 0)::float as achieved_value,
                 count(distinct op.id) filter (where op.stage = 'GM')::int as gm_count,
                 count(distinct op.id) filter (where op.stage = 'BV')::int as bv_count
            from drm.users u
            left join drm.opportunities op on op.owner_id::text = u.id::text and op.created_at between $1 and $2 and coalesce(op.is_deleted,false)=false
            left join drm.gm_entries g on (g.created_by::text = u.id::text) 
                 and g.created_at between $1 and $2 
                 and coalesce(g.is_deleted,false)=false
            where 1=1
             ${filter}
            group by u.id, name
            order by name nulls last
        `;
        const queryStart = Date.now();
        const rows = await queryWithRetry(client, sqlText, params);
        const duration = Date.now() - queryStart;
        const rowCount = Array.isArray(rows.rows) ? rows.rows.length : 0;
        console.info(
          `[route:team-queue-performance] user=${req.user.userId} duration=${duration}ms rows=${rowCount} from=${from.toISOString()} to=${to.toISOString()}`,
        );

        const items = rows.rows.map((r, idx) => {
          const achieved = Number(r.achieved_value ?? 0);
          const target = achieved > 0 ? achieved : 0; // Simplified target for now
          return {
            index: idx + 1,
            userId: r.user_id,
            person: r.name ?? "Unknown",
            target,
            achieve: achieved,
            remain: Math.max(0, target - achieved),
            aMinus: 0,
            prediction: achieved,
            gm: Number(r.gm_count ?? 0),
            bv: Number(r.bv_count ?? 0),
          };
        });

        res.json({
          success: true,
          data: {
            items,
            total: items.length,
            from: from.toISOString(),
            to: to.toISOString(),
          },
        });
      } finally {
        try {
          await client.query("set statement_timeout = default");
        } catch {
          // ignore
        }
        client.release();
        const totalDuration = Date.now() - routeStart;
        console.info(`[route:team-queue-performance] total_duration=${totalDuration}ms`);
      }
    } catch (err) {
      console.error("Error fetching team queue performance", err);
      if (isDbUnavailableError(err)) return respondDbUnavailable(res, []);
      res.status(500).json({ success: false, message: "Failed to fetch team queue performance" });
    }
  });

  // Follow up details
  app.get("/api/dashboard/followups", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
      const pageSize = Math.max(1, Math.min(100, parseInt(String(req.query.pageSize ?? "10"), 10)));
      const offset = (page - 1) * pageSize;
      const filter = req.query.filter ? String(req.query.filter) : undefined;
      const service = req.query.service ? String(req.query.service) : undefined;
      const userFilter = req.query.user ? String(req.query.user) : undefined;
      const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : undefined;
      const dateTo = req.query.dateTo ? String(req.query.dateTo) : undefined;
      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));

      const params: any[] = [];
      const where: string[] = ["coalesce(fu.is_deleted,false)=false"];
      if (filter) {
        params.push(filter);
        where.push(`fu.status = $${params.length}`);
      }
      if (service) {
        params.push(service);
        where.push(`(s.name = $${params.length} or s.code = $${params.length})`);
      }
      if (userFilter && userFilter !== "All Users") {
        params.push(userFilter);
        where.push(`coalesce(fu.assigned_to::text, c.owner_user_id::text, c.created_by::text) = $${params.length}::text`);
      }
      if (dateFrom) {
        params.push(dateFrom);
        where.push(`fu.created_at >= $${params.length}::date`);
      }
      if (dateTo) {
        params.push(dateTo);
        where.push(`fu.created_at <= $${params.length}::date + interval '1 day'`);
      }
      const allowedUserIds = await getDepartmentFilterUserIds(req);
      if (!isManager) {
        params.push(req.user.userId);
        where.push(`coalesce(fu.assigned_to::text, c.owner_user_id::text, c.created_by::text) = $${params.length}::text`);
      } else if (allowedUserIds) {
        params.push(allowedUserIds);
        where.push(`coalesce(fu.assigned_to::uuid, c.owner_user_id::uuid, c.created_by::uuid) = ANY($${params.length}::uuid[])`);
      }
      const whereSql = where.length ? `where ${where.join(" and ")}` : "";

      const listSql = `
        select fu.id,
               fu.customer_id,
               fu.due_at,
               fu.date_time,
               fu.status,
               fu.notes,
               fu.assigned_to,
               fu.created_at,
               c.company_name,
               c.drm_id,
               c.pool_type,
               coalesce(u.full_name, u.name, u.username) as sales_person,
               string_agg(distinct s.name, ', ') as service_name,
               string_agg(distinct s.code, ', ') as service_code,
               string_agg(distinct ss.name, ', ') as subservice_name,
               coalesce(max(fsd.grade), c.grade) as grade,
               coalesce(max(fsd.method), fu.method) as method,
               string_agg(distinct fsd.purpose, ', ') as purpose
          from drm.follow_ups fu
          left join drm.customers c on c.id::text = fu.customer_id::text
          left join drm.users u on u.id::text = coalesce(fu.assigned_to::text, c.owner_user_id::text, c.created_by::text)
          left join drm.followup_services fs on fs.followup_id = fu.id
          left join drm.services s on s.id = fs.service_id
          left join drm.followup_subservice_details fsd on fsd.followup_id = fu.id and fsd.service_id = s.id
          left join drm.service_subservices ss on ss.id = fsd.subservice_id
         ${whereSql}
         group by fu.id, c.id, coalesce(u.full_name, u.name, u.username)
         order by coalesce(max(fu.date_time), max(fu.due_at), max(fu.created_at)) desc, fu.id
         limit ${pageSize} offset ${offset}
      `;
      const countSql = `
        select count(distinct fu.id)::int as count
        from drm.follow_ups fu
        left join drm.customers c on c.id::text = fu.customer_id::text
        left join drm.users u on u.id::text = coalesce(fu.assigned_to::text, c.owner_user_id::text, c.created_by::text)
        left join drm.followup_services fs on fs.followup_id = fu.id
        left join drm.services s on s.id = fs.service_id
        ${whereSql}
      `;

      const [list, count] = await Promise.all([pool.query(listSql, params), pool.query(countSql, params)]);
      const total = count.rows[0]?.count ?? 0;

      res.json({
        success: true,
        data: {
          items: list.rows.map((r) => ({
            id: r.id,
            drmId: r.drm_id || r.id,
            customerId: r.customer_id,
            status: r.status,
            notes: r.notes,
            dueAt: r.due_at,
            dateTime: r.date_time,
            assignedTo: r.assigned_to,
            createdAt: r.created_at,
            company: r.company_name,
            grade: r.grade,
            poolType: r.pool_type,
            salesPerson: r.sales_person,
            serviceType: r.service_name || r.service_code || null,
            subserviceName: r.subservice_name || null,
            purpose: r.purpose,
            method: r.method,
          })),
          total,
          page,
          pageSize,
        },
      });
    } catch (err) {
      console.error("Error fetching dashboard followups", err);
      if (isDbUnavailableError(err)) return respondDbUnavailable(res, []);
      res.status(500).json({ success: false, message: "Failed to fetch followups" });
    }
  });

  // Team work performance
  app.get("/api/dashboard/team-work-performance", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      const start = req.query.start ? new Date(String(req.query.start)) : new Date(new Date().getTime() - 30 * 86400000);
      const end = req.query.end ? new Date(String(req.query.end)) : new Date();
      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));

      const roleId = normalizeRole((req.user as any).activeRoleId || req.user.roleId);
      const isGlobalAdmin = ["admin", "super_admin", "super_hod", "hod"].includes(roleId);

      const allowedUserIds = await getDepartmentFilterUserIds(req);

      const params: any[] = [start, end];
      let filter = "";
      if (!isManager) {
        filter = ` and coalesce(c.owner_user_id::text, c.created_by::text) = $${params.length + 1}::text`;
        params.push(req.user.userId);
      } else if (allowedUserIds) {
        filter = ` and coalesce(c.owner_user_id::text, c.created_by::text) = ANY($${params.length + 1}::text[])`;
        params.push(allowedUserIds);
      }

      const client = await pool.connect();
      try {
        await client.query("set statement_timeout = 8000");

        const baseRows = await queryWithRetry(
          client,
          `
            select coalesce(c.owner_user_id, c.created_by)::text as user_id,
                   coalesce(u.full_name, u.name, u.username) as name,
                   count(*)::int as leads,
                   count(*) filter (where c.status = 'New')::int as follow,
                   count(*) filter (where c.status <> 'New')::int as not_follow,
                   count(*) filter (where c.grade = 'A-')::int as a_minus,
                   count(*) filter (where c.grade = 'B+')::int as b_plus,
                   count(*) filter (where c.grade = 'B')::int as b,
                   count(*) filter (where c.grade = 'B-')::int as b_minus
              from drm.customers c
              left join drm.users u on u.id::text = coalesce(c.owner_user_id, c.created_by)::text
             where c.created_at between $1 and $2
               ${filter}
             group by coalesce(c.owner_user_id, c.created_by), coalesce(u.full_name, u.name, u.username)
             order by name nulls last
          `,
          params,
        );

        const activityParams: any[] = [start, end];
        let actFilter = "";
        if (!isManager) {
          actFilter = ` and a.created_by::text = $${activityParams.length + 1}::text`;
          activityParams.push(req.user.userId);
        } else if (allowedUserIds) {
          actFilter = ` and a.created_by::text = ANY($${activityParams.length + 1}::text[])`;
          activityParams.push(allowedUserIds);
        }
        const activityCounts = await queryWithRetry(
          client,
          `
            select a.created_by::text as user_id, count(*)::int as calls
              from drm.activities a
             where coalesce(a.activity_date, a.created_at) between $1 and $2
               ${actFilter}
             group by a.created_by
          `,
          activityParams,
        );
        const callMap = activityCounts.rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.user_id ?? "unknown"] = Number(row.calls ?? 0);
          return acc;
        }, {});

        const appointmentParams: any[] = [start, end];
        let appointmentFilter = "";
        if (!isManager) {
          appointmentFilter = ` and ap.assigned_to::text = $${appointmentParams.length + 1}::text`;
          appointmentParams.push(req.user.userId);
        } else if (allowedUserIds) {
          appointmentFilter = ` and ap.assigned_to::text = ANY($${appointmentParams.length + 1}::text[])`;
          appointmentParams.push(allowedUserIds);
        }
        const appointmentCounts = await queryWithRetry(
          client,
          `
            select ap.assigned_to::text as user_id, count(*)::int as appointments
              from drm.appointments ap
             where coalesce(ap.is_deleted,false)=false
               and coalesce(ap.starts_at, ap.created_at) between $1 and $2
               ${appointmentFilter}
             group by ap.assigned_to
          `,
          appointmentParams,
        );
        const apptMap = appointmentCounts.rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.user_id ?? "unknown"] = Number(row.appointments ?? 0);
          return acc;
        }, {});

        const rows = baseRows.rows.map((r) => {
          const key = r.user_id ?? "unknown";
          return {
            userId: r.user_id,
            name: r.name ?? "Unknown",
            leads: Number(r.leads ?? 0),
            follow: Number(r.follow ?? 0),
            notFollow: Number(r.not_follow ?? 0),
            aMinusCustomer: Number(r.a_minus ?? 0),
            bPlusCustomer: Number(r.b_plus ?? 0),
            bCustomer: Number(r.b ?? 0),
            bMinusCustomer: Number(r.b_minus ?? 0),
            callConnected: callMap[key] ?? 0,
            notResponse: 0,
            appointment: apptMap[key] ?? 0,
            meeting: apptMap[key] ?? 0,
          };
        });

        res.json({
          success: true,
          data: {
            items: rows,
            from: start.toISOString(),
            to: end.toISOString(),
          },
        });
      } finally {
        try {
          await client.query("set statement_timeout = default");
        } catch {
          // ignore
        }
        client.release();
      }
    } catch (err) {
      console.error("Error fetching team work performance", err);
      if (isDbUnavailableError(err)) return respondDbUnavailable(res, []);
      res.status(500).json({ success: false, message: "Failed to fetch team work performance" });
    }
  });

  // Orders list (opportunities as orders)
  app.get("/api/orders", async (req, res) => {
    try {
      const parsed = summaryQuerySchema.parse(req.query);
      const { from, to } = parseDateRange(parsed);
      const page = parsed.page ?? 1;
      const pageSize = parsed.pageSize ?? 10;
      const { limit, offset } = buildPagination(page, pageSize);
      const status = parsed.status;
      const sort = parsed.sort === "amount" ? "op.value" : "op.created_at";
      const region = parsed.branchId || null;

      const where: string[] = ["op.created_at between $1 and $2", "coalesce(op.is_deleted,false)=false"];
      const params: any[] = [from, to];
      let i = 3;
      if (status) {
        where.push(`op.stage = $${i++}`);
        params.push(status);
      }
      if (region) {
        where.push(`c.region = $${i++}`);
        params.push(region);
      }
      const whereSql = where.length ? `where ${where.join(" and ")}` : "";

      const listSql = `
        select op.id, op.title, op.value, op.stage as status, op.created_at,
               c.company_name, c.region, c.email, c.phone
        from drm.opportunities op
        inner join drm.customers c on c.id = op.customer_id
        ${whereSql}
        order by ${sort} desc
        limit ${limit} offset ${offset}
      `;
      const countSql = `select count(*)::int as count from drm.opportunities op inner join drm.customers c on c.id = op.customer_id ${whereSql}`;

      const [listRes, countRes] = await Promise.all([
        pool.query(listSql, params),
        pool.query<{ count: number }>(countSql, params),
      ]);

      res.json({
        data: listRes.rows.map((r: any) => ({
          id: r.id,
          title: r.title,
          total: Number(r.value),
          status: r.status,
          createdAt: r.created_at,
          customer: {
            name: r.company_name,
            region: r.region,
            email: r.email,
            phone: r.phone,
          },
        })),
        meta: {
          total: countRes.rows[0]?.count ?? 0,
          page,
          pageSize: limit,
          totalPages: Math.max(1, Math.ceil((countRes.rows[0]?.count ?? 0) / limit)),
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error fetching orders", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch orders" });
    }
  });

  // Create order (uses opportunities + existing customers)
  app.post("/api/orders", async (req, res) => {
    const bodySchema = z.object({
      customerId: z.string().uuid(),
      title: z.string().min(1),
      amount: z.coerce.number().min(0),
      stage: z.string().optional(),
    });
    try {
      const body = bodySchema.parse(req.body);
      const customerExists = await pool.query("select 1 from drm.customers where id = $1 limit 1", [body.customerId]);
      if (customerExists.rowCount === 0) {
        return res.status(400).json({ error: "BadRequest", message: "Invalid customerId" });
      }
      const inserted = await pool.query(
        `insert into opportunities (customer_id, owner_id, title, stage, value, expected_close_date, is_deleted, created_at, updated_at)
         values ($1, $2, $3, coalesce($4, 'LD'), $5, null, false, now(), now())
         returning id, title, value, stage, created_at`,
        [body.customerId, req.user!.userId, body.title, body.stage ?? null, body.amount],
      );
      res.status(201).json(inserted.rows[0]);
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error creating order", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create order" });
    }
  });

  // Update order status
  app.patch("/api/orders/:id/status", async (req, res) => {
    const bodySchema = z.object({ status: z.string().min(1) });
    try {
      const body = bodySchema.parse(req.body);
      const updated = await pool.query(
        `update opportunities set stage = $1, updated_at = now() where id = $2 returning id, stage`,
        [body.status, req.params.id],
      );
      if (updated.rowCount === 0) return res.status(404).json({ error: "NotFound", message: "Order not found" });
      res.json(updated.rows[0]);
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error updating order status", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update status" });
    }
  });

  // Refund order
  app.post("/api/orders/:id/refund", async (req, res) => {
    const bodySchema = z.object({
      amount: z.coerce.number().min(0),
      reason: z.string().optional(),
    });
    try {
      const body = bodySchema.parse(req.body);
      const order = await pool.query("select id from opportunities where id = $1", [req.params.id]);
      if (order.rowCount === 0) {
        return res.status(404).json({ error: "NotFound", message: "Order not found" });
      }
      const inserted = await pool.query(
        `insert into refunds (order_id, amount, reason) values ($1, $2, $3) returning id, order_id, amount, reason, created_at`,
        [req.params.id, body.amount, body.reason ?? null],
      );
      res.status(201).json(inserted.rows[0]);
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error creating refund", err);
      res.status(500).json({ error: "InternalError", message: "Failed to create refund" });
    }
  });

  // Export orders as CSV
  app.get("/api/orders/export.csv", async (req, res) => {
    try {
      const parsed = summaryQuerySchema.parse(req.query);
      const { from, to } = parseDateRange(parsed);
      const region = parsed.branchId || null;

      const where: string[] = ["op.created_at between $1 and $2", "coalesce(op.is_deleted,false)=false"];
      const params: any[] = [from, to];
      let i = 3;
      if (region) {
        where.push(`c.region = $${i++}`);
        params.push(region);
      }
      const whereSql = where.length ? `where ${where.join(" and ")}` : "";

      const sql = `
        select op.id, op.title, op.value, op.stage, op.created_at, c.company_name, c.region
        from opportunities op
        inner join drm.customers c on c.id = op.customer_id
        ${whereSql}
        order by op.created_at desc
      `;
      const result = await pool.query(sql, params);
      const headers = ["Order ID", "Title", "Total", "Status", "Created At", "Customer", "Region"];
      const lines = [headers.join(",")].concat(
        result.rows.map((r: any) =>
          [
            r.id,
            `"${(r.title ?? "").replace(/\"/g, '""')}"`,
            r.value,
            r.stage,
            r.created_at.toISOString(),
            `"${(r.company_name ?? "").replace(/\"/g, '""')}"`,
            r.region ?? "",
          ].join(","),
        ),
      );
      const csv = lines.join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=\"orders.csv\"");
      res.send(csv);
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error exporting orders", err);
      res.status(500).json({ error: "InternalError", message: "Failed to export orders" });
    }
  });

  // Top customers
  app.get("/api/customers/top", async (req, res) => {
    try {
      const parsed = summaryQuerySchema.parse(req.query);
      const { from, to } = parseDateRange(parsed);
      const page = parsed.page ?? 1;
      const pageSize = parsed.pageSize ?? 10;
      const { limit, offset } = buildPagination(page, pageSize);
      const region = parsed.branchId || null;

      const where: string[] = ["op.created_at between $1 and $2", "coalesce(op.is_deleted,false)=false"];
      const params: any[] = [from, to];
      let i = 3;
      if (region) {
        where.push(`c.region = $${i++}`);
        params.push(region);
      }
      const whereSql = where.length ? `where ${where.join(" and ")}` : "";

      const listSql = `
        select c.id, c.company_name, c.region, sum(op.value)::float as revenue, count(*)::int as orders
        from opportunities op
        inner join drm.customers c on c.id = op.customer_id
        ${whereSql}
        group by c.id, c.company_name, c.region
        order by revenue desc
        limit ${limit} offset ${offset}
      `;
      const countSql = `
        select count(*)::int as count
        from (
          select 1
          from opportunities op
          inner join drm.customers c on c.id = op.customer_id
          ${whereSql}
          group by c.id
        ) sub
      `;

      const [listRes, countRes] = await Promise.all([
        pool.query(listSql, params),
        pool.query<{ count: number }>(countSql, params),
      ]);

      res.json({
        data: listRes.rows,
        meta: {
          total: countRes.rows[0]?.count ?? 0,
          page,
          pageSize: limit,
          totalPages: Math.max(1, Math.ceil((countRes.rows[0]?.count ?? 0) / limit)),
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error fetching top customers", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch top customers" });
    }
  });

  // Low stock products
  app.get("/api/products/low-stock", async (req, res) => {
    try {
      const parsed = summaryQuerySchema.parse(req.query);
      const threshold = parsed.threshold ?? 10;
      const result = await pool.query(
        `select id, name, sku, price::float, stock from products where stock <= $1 order by stock asc limit 50`,
        [threshold],
      );
      res.json(result.rows);
    } catch (err) {
      if (err instanceof z.ZodError) return sendValidationError(res, err);
      console.error("Error fetching low stock products", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch products" });
    }
  });

  // Chart Data Details API
  app.get("/api/dashboard/chart-data", async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ success: false, message: "Not authenticated" });
      
      const stage = String(req.query.stage || 'LD').toUpperCase();
      const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || "10"), 10)));
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
      const offset = (page - 1) * limit;
      const search = String(req.query.search || "").trim();
      
      const params: any[] = [stage];
      let searchFilter = "";
      
      if (search) {
         params.push(`%${search}%`);
         searchFilter = ` AND (c.company_name ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.drm_id ILIKE $${params.length}) `;
      }

      // If they are not a manager, optionally filter by ownership
      const isManager = isManagerRole(((req.user as any).activeRoleId || req.user.roleId));
      let ownershipFilter = "";
      if (!isManager) {
          params.push(req.user.userId);
          ownershipFilter = ` AND coalesce(c.owner_user_id::text, op.owner_id::text, c.created_by::text) = $${params.length}::text `;
      }

      let dateFilter = "";
      const period = String(req.query.period || "");
      if (period) {
          const { from, to } = getPeriodRange(period === "MONTH" ? "MONTH" : period);
          if (from) {
              params.push(from);
              dateFilter += ` AND op.updated_at >= $${params.length}`;
          }
          if (to) {
              params.push(to);
              dateFilter += ` AND op.updated_at <= $${params.length}`;
          }
      }
      
      const countSql = `
         SELECT count(*) as total
         FROM drm.opportunities op
         INNER JOIN drm.customers c ON c.id = op.customer_id
         WHERE lower(op.stage) = lower($1)
           AND coalesce(op.is_deleted, false) = false
           ${searchFilter}
           ${ownershipFilter}
           ${dateFilter}
      `;
      const countResult = await pool.query(countSql, params);
      const total = parseInt(countResult.rows[0].total, 10);

      params.push(limit);
      const limitIndex = params.length;
      params.push(offset);
      const offsetIndex = params.length;

      const sql = `
         SELECT 
            c.drm_id as id,
            c.company_name as company,
            c.account_name as account,
            c.email as email,
            c.phone as phone,
            c.grade as grade,
            op.created_at as create_date
         FROM drm.opportunities op
         INNER JOIN drm.customers c ON c.id = op.customer_id
         WHERE lower(op.stage) = lower($1)
           AND coalesce(op.is_deleted, false) = false
           ${searchFilter}
           ${ownershipFilter}
           ${dateFilter}
         ORDER BY op.updated_at DESC
         LIMIT $${limitIndex} OFFSET $${offsetIndex}
      `;
      
      const result = await pool.query(sql, params);
      
      res.json({
         success: true,
         total: total,
         data: result.rows.map((r: any) => ({
            id: r.id || '-',
            company: r.company || '-',
            account: r.account || '-',
            email: r.email || '-',
            phone: r.phone || '-',
            grade: r.grade || '-',
            create: r.create_date ? new Date(r.create_date).toISOString().split('T')[0] : '-'
         }))
      });

    } catch (err) {
      console.error("Error fetching chart data details", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch chart data" });
    }
  });
}
