import { Router } from "express";
import { z } from "zod";
import { db, pool } from "../db";
import {
  customers,
  activities,
  appointments,
  projects,
  gmEntries,
  queueSalesEntries,
  teamPerformanceSnapshots,
  users,
  tempContacts,
  gmPoolEntries,
  insertCustomerSchema,
  insertProjectSchema,
} from "@shared/schema";
import { eq, and, or, ilike, gte, lte, desc, asc, sql } from "drizzle-orm";

const router = Router();

const CUSTOMER_SORTABLE_COLUMNS = {
  createdAt: customers.createdAt,
  companyName: customers.companyName,
  accountName: customers.accountName,
  email: customers.email,
  phone: customers.phone,
  grade: customers.grade,
  status: customers.status,
  poolType: customers.poolType,
} as const;

type CustomerSortColumn = keyof typeof CUSTOMER_SORTABLE_COLUMNS;

function parseDateRange(dateFrom?: string, dateTo?: string) {
  const from = dateFrom ? new Date(dateFrom) : undefined;
  const to = dateTo ? new Date(dateTo) : undefined;
  return { from, to };
}

function parsePagination(page?: string, pageSize?: string) {
  const p = parseInt(page || "1");
  const ps = parseInt(pageSize || "10");
  return { page: Math.max(1, p), pageSize: Math.min(100, Math.max(1, ps)) };
}

router.get("/customers", async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
    const { from, to } = parseDateRange(req.query.dateFrom as string, req.query.dateTo as string);
    const search = req.query.search as string;
    const grade = req.query.grade as string;
    const status = req.query.status as string;
    const poolType = req.query.poolType as string;
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(customers.companyName, `%${search}%`),
          ilike(customers.accountName, `%${search}%`),
          ilike(customers.email, `%${search}%`),
          ilike(customers.phone, `%${search}%`)
        )
      );
    }
    if (grade) conditions.push(eq(customers.grade, grade));
    if (status) conditions.push(eq(customers.status, status as any));
    if (poolType) conditions.push(eq(customers.poolType, poolType as any));
    if (from) conditions.push(gte(customers.createdAt, from));
    if (to) conditions.push(lte(customers.createdAt, to));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const validSortBy = sortBy in CUSTOMER_SORTABLE_COLUMNS ? sortBy as CustomerSortColumn : "createdAt";
    const orderColumn = CUSTOMER_SORTABLE_COLUMNS[validSortBy];
    const [countResult, customerList] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(customers).where(whereClause),
      db.select()
        .from(customers)
        .where(whereClause)
        .orderBy(sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = countResult[0]?.count || 0;

    res.json({
      customers: customerList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

router.get("/customers/search", async (req, res) => {
  try {
    const q = ((req.query.q as string) || (req.query.search as string) || "").trim();
    const limit = Math.min(20, Number(req.query.limit) || 10);
    const poolOnly = req.query.poolOnly === "true";
    const userId = (req as any).user?.userId;

    const results: any[] = [];
    const seen = new Set<string>();

    console.log(`[Search Debug] Start q="${q}" limit=${limit} poolOnly=${poolOnly}`);

    let customerCondition = q ? or(
      ilike(customers.companyName, `%${q}%`),
      ilike(customers.accountName, `%${q}%`)
    ) : undefined;

    if (poolOnly && userId) {
      const poolCondition = and(
        sql`pool_type IN ('Private', 'GMBV')`,
        sql`coalesce(owner_user_id, created_by) = ${userId}`
      );
      customerCondition = customerCondition ? and(customerCondition, poolCondition) : poolCondition as any;
    }

    // 1. Search customers
    const custMatches = await db
      .select({
        id: customers.id,
        companyName: customers.companyName,
        accountName: customers.accountName,
      })
      .from(customers)
      .where(customerCondition)
      .orderBy(desc(customers.createdAt))
      .limit(limit);

    for (const c of custMatches) {
      results.push(c);
      seen.add((c.companyName || "").toLowerCase());
    }
    console.log(`[Search Debug] After customers: results=${results.length}`);

    // 2. Search gm_entries if needed
    if (results.length < limit && !poolOnly) {
      const remaining = limit - results.length;
      const gmRaw = await db
        .select({
          id: gmEntries.id,
          companyName: gmEntries.companyName,
        })
        .from(gmEntries)
        .where(q ? ilike(gmEntries.companyName, `%${q}%`) : undefined)
        .orderBy(desc(gmEntries.createdAt))
        .limit(remaining * 2);

      for (const g of gmRaw) {
        const key = (g.companyName || "").toLowerCase();
        if (key && !seen.has(key)) {
          results.push({ id: g.id, companyName: g.companyName, accountName: g.companyName });
          seen.add(key);
          if (results.length >= limit) break;
        }
      }
      console.log(`[Search Debug] After gmEntries: results=${results.length}`);
    }

    // 3. Search temp_contacts if still needed
    if (results.length < limit && !poolOnly) {
      const remaining = limit - results.length;
      const tempMatches = await db
        .select({
          id: tempContacts.id,
          personName: tempContacts.personName,
        })
        .from(tempContacts)
        .where(q ? or(
          ilike(tempContacts.personName, `%${q}%`),
          ilike(tempContacts.email, `%${q}%`)
        ) : undefined)
        .orderBy(desc(tempContacts.createdAt))
        .limit(remaining * 2);

      console.log(`[Search Debug] tempMatches raw found: ${tempMatches.length}`);

      for (const t of tempMatches) {
        const key = (t.personName || "").toLowerCase();
        if (key && !seen.has(key)) {
          results.push({
            id: t.id,
            companyName: t.personName,
            accountName: t.personName,
          });
          seen.add(key);
          if (results.length >= limit) break;
        }
      }
      console.log(`[Search Debug] After tempContacts: results=${results.length}`);
    }

    console.log(`[Search Debug] Final results: ${results.length}`);
    return res.json({ customers: results });

  } catch (error) {
    console.error("Error searching customers:", error);
    return res.status(500).json({ error: "Failed to search customers" });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const validatedData = insertCustomerSchema.parse(req.body);
    const [newCustomer] = await db.insert(customers).values(validatedData).returning();
    res.status(201).json(newCustomer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error creating customer:", error);
    res.status(500).json({ error: "Failed to create customer" });
  }
});

router.post("/customers/check-duplicate", async (req, res) => {
  try {
    const { company, email, phone } = req.body;

    if (!company && !email && !phone) {
      return res.json({ duplicates: [], count: 0, hasMatches: false });
    }

    const conditions = [];
    if (company) conditions.push(ilike(customers.companyName, `%${company}%`));
    if (email) conditions.push(ilike(customers.email, `%${email}%`));
    if (phone) conditions.push(ilike(customers.phone, `%${phone}%`));

    const duplicates = await db
      .select()
      .from(customers)
      .where(or(...conditions))
      .limit(20);

    res.json({
      duplicates,
      count: duplicates.length,
      hasMatches: duplicates.length > 0,
    });
  } catch (error) {
    console.error("Error checking duplicates:", error);
    res.status(500).json({ error: "Failed to check duplicates" });
  }
});

router.get("/activities", async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
    const { from, to } = parseDateRange(req.query.dateFrom as string, req.query.dateTo as string);
    const userId = req.query.userId as string;

    const clauses: string[] = ["coalesce(is_deleted,false) = false"];
    const params: any[] = [];
    let i = 1;
    if (userId) {
      clauses.push(`created_by = $${i++}`);
      params.push(userId);
    }
    if (from) {
      clauses.push(`activity_date >= $${i++}`);
      params.push(from);
    }
    if (to) {
      clauses.push(`activity_date <= $${i++}`);
      params.push(to);
    }
    const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";

    const countResult = await pool.query<{ count: number }>(
      `select count(*)::int as count from activities ${whereSql}`,
      params,
    );
    const listResult = await pool.query(
      `select id, customer_id, type as method, notes, activity_date, created_by
       from activities
       ${whereSql}
       order by activity_date desc
       limit $${i} offset $${i + 1}`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    const activityList = listResult.rows.map((row: any) => ({
      id: row.id,
      userId: row.created_by,
      customerId: row.customer_id,
      method: row.method || "unknown",
      durationMinutes: 0,
      dateTime: row.activity_date,
      note: row.notes,
      createdAt: row.activity_date,
    }));

    const total = countResult.rows[0]?.count || 0;

    res.json({
      activities: activityList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

router.get("/meetings", async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
    const { from, to } = parseDateRange(req.query.dateFrom as string, req.query.dateTo as string);
    const userId = req.query.userId as string;

    const clauses: string[] = ["coalesce(is_deleted,false) = false"];
    const params: any[] = [];
    let i = 1;
    if (userId) {
      clauses.push(`assigned_to = $${i++}`);
      params.push(userId);
    }
    if (from) {
      clauses.push(`starts_at >= $${i++}`);
      params.push(from);
    }
    if (to) {
      clauses.push(`starts_at <= $${i++}`);
      params.push(to);
    }
    const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";

    const countResult = await pool.query<{ count: number }>(
      `select count(*)::int as count from drm.appointments ${whereSql}`,
      params,
    );
    const listResult = await pool.query(
      `select id, customer_id, starts_at, ends_at, location, notes, assigned_to
       from drm.appointments
       ${whereSql}
       order by starts_at desc
       limit $${i} offset $${i + 1}`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    const meetingsList = listResult.rows.map((row: any) => ({
      id: row.id,
      userId: row.assigned_to,
      customerId: row.customer_id,
      purpose: row.notes || row.location || "Meeting",
      dateTime: row.starts_at,
      createdAt: row.starts_at,
    }));

    const total = countResult.rows[0]?.count || 0;

    res.json({
      meetings: meetingsList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: "Failed to fetch meetings" });
  }
});

router.get("/team-performance", async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
    const periodMonth = req.query.month ? parseInt(req.query.month as string) : undefined;
    const periodYear = req.query.year ? parseInt(req.query.year as string) : undefined;
    const userId = req.query.userId as string;

    const clauses: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (periodMonth) {
      clauses.push(`date_part('month', t.snapshot_date) = $${i++}`);
      params.push(periodMonth);
    }
    if (periodYear) {
      clauses.push(`date_part('year', t.snapshot_date) = $${i++}`);
      params.push(periodYear);
    }
    if (userId) {
      clauses.push(`t.user_id = $${i++}`);
      params.push(userId);
    }
    const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";

    const countRes = await pool.query<{ count: number }>(
      `select count(*)::int as count from team_performance_snapshots t ${whereSql}`,
      params,
    );

    const listRes = await pool.query(
      `select 
         t.id,
         t.user_id,
         t.snapshot_date,
         t.metrics_json,
         u.full_name as user_name
       from team_performance_snapshots t
       left join users u on u.id = t.user_id
       ${whereSql}
       order by t.snapshot_date desc
       limit $${i} offset $${i + 1}`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    const performanceList = listRes.rows.map((row: any) => {
      const metrics = row.metrics_json || {};
      return {
        id: row.id,
        userId: row.user_id,
        periodMonth: row.snapshot_date ? new Date(row.snapshot_date).getMonth() + 1 : null,
        periodYear: row.snapshot_date ? new Date(row.snapshot_date).getFullYear() : null,
        totalSales: metrics.totalSales ?? "0",
        totalLeads: metrics.totalLeads ?? 0,
        convertedLeads: metrics.convertedLeads ?? 0,
        activitiesCount: metrics.activitiesCount ?? 0,
        callMinutes: metrics.callMinutes ?? 0,
        meetingsCount: metrics.meetingsCount ?? 0,
        conversionRate: metrics.conversionRate ?? "0",
        avgDealSize: metrics.avgDealSize ?? "0",
        createdAt: row.snapshot_date,
        userName: row.user_name ?? "",
      };
    });

    const total = countRes.rows[0]?.count || 0;

    res.json({
      performance: performanceList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching team performance:", error);
    res.status(500).json({ error: "Failed to fetch team performance" });
  }
});

router.get("/queue-sales", async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
    const status = req.query.status as string;
    const salesPersonId = req.query.salesPersonId as string;
    const priority = req.query.priority ? parseInt(req.query.priority as string) : undefined;

    const clauses: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (status) {
      clauses.push(`q.status = $${i++}`);
      params.push(status);
    }
    // salesPersonId/priority columns do not exist in DB; ignore those filters
    const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";

    const countResult = await pool.query<{ count: number }>(
      `select count(*)::int as count from queue_sales_entries q ${whereSql}`,
      params,
    );

    const listResult = await pool.query(
      `select 
         q.id,
         q.customer_id,
         q.status,
         q.notes,
         q.created_at,
         q.updated_at,
         c.company_name as customer_name
       from queue_sales_entries q
       left join drm.customers c on c.id = q.customer_id
       ${whereSql}
       order by q.created_at desc
       limit $${i} offset $${i + 1}`,
      [...params, pageSize, (page - 1) * pageSize],
    );

    const queueList = listResult.rows.map((row: any) => ({
      id: row.id,
      customerId: row.customer_id,
      salesPersonId: null,
      priority: null,
      status: row.status,
      queueNumber: null,
      estimatedTime: null,
      notes: row.notes,
      assignedAt: null,
      completedAt: null,
      createdAt: row.created_at,
      customerName: row.customer_name,
      salesPersonName: null,
    }));

    const total = countResult.rows[0]?.count || 0;

    res.json({
      queue: queueList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching queue sales:", error);
    res.status(500).json({ error: "Failed to fetch queue sales" });
  }
});

router.get("/gm-pool", async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
    const { from, to } = parseDateRange(req.query.dateFrom as string, req.query.dateTo as string);
    const search = req.query.search as string;
    const status = req.query.status as string;
    const hodApproved = req.query.hodApproved ? parseInt(req.query.hodApproved as string) : undefined;
    const accountantVerified = req.query.accountantVerified ? parseInt(req.query.accountantVerified as string) : undefined;

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(gmPoolEntries.memberId, `%${search}%`),
          ilike(gmPoolEntries.orderId, `%${search}%`),
          ilike(gmPoolEntries.package, `%${search}%`)
        )
      );
    }
    if (status) conditions.push(eq(gmPoolEntries.status, status as any));
    if (hodApproved !== undefined) conditions.push(eq(gmPoolEntries.hodApproved, hodApproved));
    if (accountantVerified !== undefined) conditions.push(eq(gmPoolEntries.accountantVerified, accountantVerified));
    if (from) conditions.push(gte(gmPoolEntries.createdAt, from));
    if (to) conditions.push(lte(gmPoolEntries.createdAt, to));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, gmPoolList] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(gmPoolEntries).where(whereClause),
      db.select({
        id: gmPoolEntries.id,
        memberId: gmPoolEntries.memberId,
        orderId: gmPoolEntries.orderId,
        customerId: gmPoolEntries.customerId,
        salesPersonId: gmPoolEntries.salesPersonId,
        package: gmPoolEntries.package,
        dollarRate: gmPoolEntries.dollarRate,
        discount: gmPoolEntries.discount,
        status: gmPoolEntries.status,
        hodApproved: gmPoolEntries.hodApproved,
        accountantVerified: gmPoolEntries.accountantVerified,
        createdAt: gmPoolEntries.createdAt,
        customerName: customers.companyName,
        salesPersonName: users.name,
      })
        .from(gmPoolEntries)
        .leftJoin(customers, eq(gmPoolEntries.customerId, customers.id))
        .leftJoin(users, eq(gmPoolEntries.salesPersonId, users.id))
        .where(whereClause)
        .orderBy(desc(gmPoolEntries.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = countResult[0]?.count || 0;

    res.json({
      gmPool: gmPoolList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching GM pool:", error);
    res.status(500).json({ error: "Failed to fetch GM pool" });
  }
});

router.get("/projects", async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query.page as string, req.query.pageSize as string);
    const { from, to } = parseDateRange(req.query.dateFrom as string, req.query.dateTo as string);
    const search = req.query.search as string;
    const status = req.query.status as string;
    const ownerId = req.query.ownerId as string;

    const conditions = [];
    if (search) {
      conditions.push(
        or(
          ilike(projects.name, `%${search}%`),
          ilike(projects.description || '', `%${search}%`)
        )
      );
    }
    if (status) conditions.push(eq(projects.status, status as any));
    if (ownerId) conditions.push(eq(projects.ownerUserId, ownerId));
    if (from) conditions.push(gte(projects.createdAt, from));
    if (to) conditions.push(lte(projects.createdAt, to));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, projectList] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(projects).where(whereClause),
      db.select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        ownerUserId: projects.ownerUserId,
        workSpace: projects.workSpace,
        status: projects.status,
        startDate: projects.startDate,
        endDate: projects.endDate,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        ownerName: users.name,
      })
        .from(projects)
        .leftJoin(users, eq(projects.ownerUserId, users.id))
        .where(whereClause)
        .orderBy(desc(projects.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = countResult[0]?.count || 0;

    res.json({
      projects: projectList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const validatedData = insertProjectSchema.parse(req.body);
    const [newProject] = await db.insert(projects).values(validatedData).returning();
    res.status(201).json(newProject);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// Related Customers endpoints
router.get("/related-customers", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        customer_name as "customerName", 
        related_customer as "relatedCustomer",
        person_name as "personName",
        follow_status as "followStatus",
        invoice_number as "invoiceNumber",
        receipt_number as "receiptNumber",
        package_type as "packageType",
        gm_amount as "gmAmount",
        pay_date as "payDate",
        bv_date as "bvDate",
        is_disabled as "isDisabled",
        created_at as "createdAt"
      FROM related_customers
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching related customers:", error);
    res.status(500).json({ error: "Failed to fetch related customers" });
  }
});

router.post("/related-customers", async (req, res) => {
  try {
    const {
      customerName,
      relatedCustomer,
      personName,
      followStatus,
      invoiceNumber,
      receiptNumber,
      packageType,
      gmAmount,
      payDate,
      bvDate,
      isDisabled
    } = req.body;

    if (!customerName || !relatedCustomer) {
      return res.status(400).json({ error: "Customer name and related customer are required" });
    }

    const result = await pool.query(`
      INSERT INTO related_customers (
        customer_name, 
        related_customer, 
        person_name, 
        follow_status, 
        invoice_number, 
        receipt_number, 
        package_type, 
        gm_amount, 
        pay_date, 
        bv_date,
        is_disabled, 
        created_at, 
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING 
        id, 
        customer_name as "customerName", 
        related_customer as "relatedCustomer",
        person_name as "personName",
        follow_status as "followStatus",
        invoice_number as "invoiceNumber",
        receipt_number as "receiptNumber",
        package_type as "packageType",
        gm_amount as "gmAmount",
        pay_date as "payDate",
        bv_date as "bvDate",
        is_disabled as "isDisabled",
        created_at as "createdAt"
    `, [
      customerName,
      relatedCustomer,
      personName || null,
      followStatus || null,
      invoiceNumber || null,
      receiptNumber || null,
      packageType || null,
      gmAmount || null,
      payDate || null,
      bvDate || null,
      isDisabled || false
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error("Error creating related customer:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    res.status(500).json({
      error: "Failed to create related customer",
      details: error.message
    });
  }
});

router.put("/related-customers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      relatedCustomer,
      personName,
      followStatus,
      invoiceNumber,
      receiptNumber,
      packageType,
      gmAmount,
      payDate,
      bvDate,
      isDisabled
    } = req.body;

    if (!customerName || !relatedCustomer) {
      return res.status(400).json({ error: "Customer name and related customer are required" });
    }

    const result = await pool.query(`
      UPDATE related_customers
      SET 
        customer_name = $1,
        related_customer = $2,
        person_name = $3,
        follow_status = $4,
        invoice_number = $5,
        receipt_number = $6,
        package_type = $7,
        gm_amount = $8,
        pay_date = $9,
        bv_date = $10,
        is_disabled = $11,
        updated_at = NOW()
      WHERE id = $12
      RETURNING 
        id, 
        customer_name as "customerName", 
        related_customer as "relatedCustomer",
        person_name as "personName",
        follow_status as "followStatus",
        invoice_number as "invoiceNumber",
        receipt_number as "receiptNumber",
        package_type as "packageType",
        gm_amount as "gmAmount",
        pay_date as "payDate",
        bv_date as "bvDate",
        is_disabled as "isDisabled",
        updated_at as "updatedAt"
    `, [
      customerName,
      relatedCustomer,
      personName || null,
      followStatus || null,
      invoiceNumber || null,
      receiptNumber || null,
      packageType || null,
      gmAmount || null,
      payDate || null,
      bvDate || null,
      isDisabled || false,
      id
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Related customer not found" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Error updating related customer:", error);
    res.status(500).json({
      error: "Failed to update related customer",
      details: error.message
    });
  }
});

router.delete("/related-customers/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM related_customers
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Related customer not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting related customer:", error);
    res.status(500).json({ error: "Failed to delete related customer" });
  }
});

export default router;
