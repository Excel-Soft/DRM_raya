import { Express, Request, Response } from "express";

import { requireRole } from "./auth.middleware";
import { db, pool } from "./db";
import {
  serviceCustomers,
  serviceActivities,
  serviceTargets,
  serviceFollowups,
  serviceRenewals,
  appointments,
  meetings,
  customers,
  users,
  serviceComplaints,
  serviceDropouts,
  serviceCustomerFeedback,
  serviceSampleRequests
} from "../shared/schema";
import { eq, and, sql, gte, lte, desc, inArray } from "drizzle-orm";
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from "date-fns";
import { computeExpiryState } from "./utils/service-expiry";
import { ensureBridgeLinksTable } from "./services/service-bridge.service";
import { bucketServiceKpis } from "./utils/service-kpi";
import { getDepartmentFilterUserIds, getPeriodRange } from "./dashboard-routes";
import { ensureServiceFeedbackTables } from "./service-core-routes";

export function registerServiceManagerRoutes(app: Express) {
  // Phase 16 (SRV-002) — these 5 endpoints previously had no role restriction
  // beyond global auth; any authenticated user of any role could read Service
  // Manager stats/activities/queue-performance/graph/team-performance. Gated
  // to the roles the module's own name and content imply. service_assistant_manager
  // is included because service-assistant-manager-dashboard.tsx calls these
  // same endpoints for its own Top Selling / Activities widgets.
  const serviceManagerGate = requireRole("service_manager", "service_assistant_manager", "admin");

  // Manager Stats / Top Cards
  app.get("/api/service/manager/stats", serviceManagerGate, async (req: Request, res: Response) => {
    try {
      // Period filter (TD / WC / MONTH, same resolver dashboard-routes.ts uses
      // elsewhere) — scopes to service records added, and revenue recorded,
      // within the selected window. Defaults to WC to match the widget's
      // pre-existing default period.
      const { from, to } = getPeriodRange(String(req.query.period ?? "WC"));

      // Joined with the parent `customers` row so we can read `service_types`
      // (the same column dashboard-routes.ts uses for the Sales-side VM/KWA/
      // PSA/Sponsor KPIs) — service_customers has no such column of its own.
      const rows = await db
        .select({
          serviceCustomer: serviceCustomers,
          customerServiceTypes: customers.serviceTypes,
        })
        .from(serviceCustomers)
        .leftJoin(customers, eq(serviceCustomers.customerId, customers.id))
        .where(and(gte(serviceCustomers.createdAt, from), lte(serviceCustomers.createdAt, to)));

      let newCount = 0;
      let renewCount = 0;
      let expireCount = 0;
      let activeCount = 0;

      for (const row of rows) {
        const cust = row.serviceCustomer;
        const state = computeExpiryState(cust.expiryDate);
        if (state === "active") activeCount++;
        if (state === "expiring") expireCount++;
        // `status` records the last life-cycle transition recorded against the
        // service record — 'renewed'/'upgraded' means a renewal action already
        // happened, anything else still on its original ('active') cycle counts
        // as "new".
        if (cust.status === "renewed" || cust.status === "upgraded") renewCount++;
        else if (cust.status === "active") newCount++;
      }

      const kpi = bucketServiceKpis(rows.map((r) => ({ serviceTypes: r.customerServiceTypes })));

      // Total revenue = sum of recorded service-renewal amounts, the only
      // defensible revenue source the service module owns today.
      const revenueRows = await db
        .select({ totalRevenue: sql<number>`COALESCE(SUM(${serviceRenewals.amount}), 0)::float` })
        .from(serviceRenewals)
        .where(and(gte(serviceRenewals.createdAt, from), lte(serviceRenewals.createdAt, to)));
      const totalRevenue = revenueRows[0]?.totalRevenue ?? 0;

      res.json({
        totalRevenue,
        new: newCount,
        renew: renewCount,
        expire: expireCount,
        inService: activeCount,
        vm: kpi.vm.count,
        kwa: kpi.kwa.count,
        psa: kpi.psa.count,
        sponsorBrand: kpi.sponsor.count,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Roll-up of Manager activities section. `period` is optional (TD/WC/MONTH,
  // same resolver as /stats) — omitted entirely preserves the previous
  // all-time behavior for callers that don't pass it.
  app.get("/api/service/manager/activities", serviceManagerGate, async (req: Request, res: Response) => {
    try {
      const dateFilter = req.query.period
        ? (() => {
            const { from, to } = getPeriodRange(String(req.query.period));
            return and(gte(serviceActivities.activityDate, from), lte(serviceActivities.activityDate, to));
          })()
        : undefined;

      // Grouping logic for method-based activity counts.
      // For instance: grouping by "method" field.
      // E-mail, OnSite Visit, WhatsApp, etc.

      const counts = await db.select({
        method: serviceActivities.method,
        count: sql<number>`count(${serviceActivities.id})::int`,
        target: sql<number>`COALESCE(SUM(${serviceActivities.targetValue}), 0)::float`,
        achieved: sql<number>`COALESCE(SUM(${serviceActivities.achievedValue}), 0)::float`,
      })
      .from(serviceActivities)
      .where(dateFilter)
      .groupBy(serviceActivities.method);

      // Transform into object { WhatsApp: 5, Call: 10 }
      const methodCounts: Record<string, number> = {};
      const methodTargets: Record<string, { target: number; achieved: number }> = {};
      counts.forEach((c: any) => {
        methodCounts[c.method] = c.count;
        methodTargets[c.method] = { target: c.target, achieved: c.achieved };
      });

      const totalMinutesRows = await db
        .select({ totalMinutes: sql<number>`COALESCE(SUM(${serviceActivities.durationMinutes}), 0)::int` })
        .from(serviceActivities)
        .where(dateFilter);

      res.json({
        methodCounts,
        methodTargets,
        totalMinutes: totalMinutesRows[0]?.totalMinutes ?? 0,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch manager activities" });
    }
  });

  // Team Queue Service Sales / Target Performance
  app.get("/api/service/manager/queue-performance", serviceManagerGate, async (req: Request, res: Response) => {
    try {
      // Return a list of users involved in "service" department and their targets.
      // users.department is never actually populated (always null/empty) for
      // any real account, including service_* ones — role_id is the real,
      // consistently-set signal for department membership everywhere else in
      // this codebase, so filter on that instead.
      let serviceUsers = await db.select().from(users).where(sql`${users.roleId} ILIKE 'service_%'`);

      // Narrow to this manager's own reports (via under_works) when the caller
      // isn't a global admin. getDepartmentFilterUserIds returns null for a
      // global admin (no narrowing — preserves the previous "view all" shape).
      const allowedUserIds = await getDepartmentFilterUserIds(req);
      if (allowedUserIds) {
        const allowedSet = new Set(allowedUserIds);
        serviceUsers = serviceUsers.filter((u) => allowedSet.has(u.id));
      }

      const userIds = serviceUsers.map((u) => u.id);

      // Active service→GM / service→BV bridge counts per creator. These are sourced
      // directly from drm.service_bridge_links (the bridge owns this data), so they
      // are defensible.
      const bridgeCounts: Record<string, { gm: number; bv: number }> = {};
      try {
        await ensureBridgeLinksTable();
        const { rows } = await pool.query<{ createdBy: string; targetModule: string; n: number }>(
          `SELECT created_by AS "createdBy", target_module AS "targetModule", COUNT(*)::int AS n
             FROM drm.service_bridge_links
            WHERE status = 'active' AND target_module IN ('gm','bv') AND created_by IS NOT NULL
            GROUP BY created_by, target_module`,
        );
        for (const r of rows) {
          const key = String(r.createdBy);
          if (!bridgeCounts[key]) bridgeCounts[key] = { gm: 0, bv: 0 };
          if (r.targetModule === "gm") bridgeCounts[key].gm = r.n;
          else if (r.targetModule === "bv") bridgeCounts[key].bv = r.n;
        }
      } catch (bridgeErr) {
        console.error("[ServiceManager] bridge counts unavailable", bridgeErr);
      }

      // Real per-user queue metrics, sourced from service_customers (case load
      // + life-cycle status), the parent customers row (grade, for "A-"), and
      // service_targets (assigned quota).
      const caseloadCounts: Record<string, { total: number; achieve: number; aMinus: number }> = {};
      const targetTotals: Record<string, number> = {};

      if (userIds.length > 0) {
        const caseloadRows = await db
          .select({
            assignedTo: serviceCustomers.assignedTo,
            status: serviceCustomers.status,
            grade: customers.grade,
          })
          .from(serviceCustomers)
          .leftJoin(customers, eq(serviceCustomers.customerId, customers.id))
          .where(inArray(serviceCustomers.assignedTo, userIds));

        for (const row of caseloadRows) {
          const key = row.assignedTo ? String(row.assignedTo) : null;
          if (!key) continue;
          if (!caseloadCounts[key]) caseloadCounts[key] = { total: 0, achieve: 0, aMinus: 0 };
          caseloadCounts[key].total += 1;
          if (row.status === "renewed" || row.status === "upgraded") caseloadCounts[key].achieve += 1;
          if (row.grade === "A-") caseloadCounts[key].aMinus += 1;
        }

        const targetRows = await db
          .select({
            userId: serviceTargets.userId,
            targetValue: serviceTargets.targetValue,
          })
          .from(serviceTargets)
          .where(inArray(serviceTargets.userId, userIds));

        for (const row of targetRows) {
          const key = row.userId ? String(row.userId) : null;
          if (!key) continue;
          targetTotals[key] = (targetTotals[key] ?? 0) + (Number(row.targetValue) || 0);
        }
      }

      const data = [];
      for (const user of serviceUsers) {
        const counts = bridgeCounts[user.id] || { gm: 0, bv: 0 };
        const caseload = caseloadCounts[user.id] || { total: 0, achieve: 0, aMinus: 0 };
        const target = targetTotals[user.id] ?? 0;
        // "Prediction" mirrors the same simplification the generic
        // /api/dashboard/team-queue-performance endpoint already uses
        // (prediction = achieved) rather than inventing a projection formula.
        data.push({
          user: user.fullName || user.username,
          total: caseload.total,
          target,
          achieve: caseload.achieve,
          remain: Math.max(0, target - caseload.achieve),
          aMinus: caseload.aMinus,
          prediction: caseload.achieve,
          gm: counts.gm,
          bv: counts.bv
        });
      }

      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch queue performance" });
    }
  });

  // Current Month Graph Map
  app.get("/api/service/manager/current-month-graph", serviceManagerGate, async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);

      const dailyMap: Record<string, number> = {};
      eachDayOfInterval({ start, end }).forEach(day => {
        dailyMap[format(day, 'yyyy-MM-dd')] = 0;
      });

      // Populate from real service-activity volume for the current month.
      const dailyCounts = await db
        .select({
          day: sql<string>`to_char(${serviceActivities.activityDate}, 'YYYY-MM-DD')`,
          count: sql<number>`count(${serviceActivities.id})::int`,
        })
        .from(serviceActivities)
        .where(and(gte(serviceActivities.activityDate, start), lte(serviceActivities.activityDate, end)))
        .groupBy(sql`to_char(${serviceActivities.activityDate}, 'YYYY-MM-DD')`);

      for (const row of dailyCounts) {
        if (row.day in dailyMap) dailyMap[row.day] = row.count;
      }

      const responseArray = Object.keys(dailyMap).map(k => ({ date: k, count: dailyMap[k] }));

      res.json(responseArray);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch month graph" });
    }
  });

  // Most Detailed Team Work Performance
  app.get("/api/service/manager/team-work-performance", serviceManagerGate, async (req: Request, res: Response) => {
    try {
      await ensureServiceFeedbackTables();
      const start = req.query.start ? new Date(String(req.query.start)) : new Date(Date.now() - 30 * 86400000);
      const end = req.query.end ? new Date(String(req.query.end)) : new Date();

      // Same role_id-based filter as queue-performance above — users.department
      // is never populated for service_* accounts.
      let serviceUsers = await db.select().from(users).where(sql`${users.roleId} ILIKE 'service_%'`);
      const allowedUserIds = await getDepartmentFilterUserIds(req);
      if (allowedUserIds) {
        const allowedSet = new Set(allowedUserIds);
        serviceUsers = serviceUsers.filter((u) => allowedSet.has(u.id));
      }
      const userIds = serviceUsers.map((u) => u.id);
      if (userIds.length === 0) {
        return res.json([]);
      }

      // Case load + grade mix (the whole assigned book, not date-scoped — a
      // case load isn't bounded by the report's date range).
      const caseloadRows = await db
        .select({
          assignedTo: serviceCustomers.assignedTo,
          id: serviceCustomers.id,
          customerId: serviceCustomers.customerId,
          grade: customers.grade,
          serviceTypes: customers.serviceTypes,
        })
        .from(serviceCustomers)
        .leftJoin(customers, eq(serviceCustomers.customerId, customers.id))
        .where(inArray(serviceCustomers.assignedTo, userIds));

      const leadsByUser: Record<string, number> = {};
      const gradeByUser: Record<string, { aMinus: number; bPlus: number; b: number; bMinus: number }> = {};
      const serviceCustomerToUser: Record<string, string> = {};
      const customerToUser: Record<string, string> = {};
      const productsByUser: Record<string, number> = {};
      for (const row of caseloadRows) {
        const key = row.assignedTo ? String(row.assignedTo) : null;
        if (!key) continue;
        leadsByUser[key] = (leadsByUser[key] ?? 0) + 1;
        if (!gradeByUser[key]) gradeByUser[key] = { aMinus: 0, bPlus: 0, b: 0, bMinus: 0 };
        if (row.grade === "A-") gradeByUser[key].aMinus++;
        else if (row.grade === "B+") gradeByUser[key].bPlus++;
        else if (row.grade === "B") gradeByUser[key].b++;
        else if (row.grade === "B-") gradeByUser[key].bMinus++;
        serviceCustomerToUser[row.id] = key;
        if (row.customerId) customerToUser[String(row.customerId)] = key;
        productsByUser[key] = (productsByUser[key] ?? 0) + (row.serviceTypes?.length ?? 0);
      }

      // Quotations (RFQs) raised in range for this rep's customers — real
      // Quotation records (server/quotation-routes.ts), attributed back to the
      // assigned rep via the same customer->rep map used above (quotations has
      // no rep column of its own).
      const rfqByUser: Record<string, number> = {};
      try {
        const customerIds = Object.keys(customerToUser);
        if (customerIds.length > 0) {
          const quotationRows = await pool.query<{ customer_id: string | null }>(
            `select customer_id from quotations where customer_id = ANY($1::text[]) and created_at between $2 and $3`,
            [customerIds, start, end],
          );
          for (const row of quotationRows.rows) {
            const userId = row.customer_id ? customerToUser[row.customer_id] : undefined;
            if (userId) rfqByUser[userId] = (rfqByUser[userId] ?? 0) + 1;
          }
        }
      } catch (err) {
        console.error("Failed to fetch quotations for team work performance", err);
      }

      // Follow-ups created within the selected range, assigned to the user.
      const followupRows = await db
        .select({
          assignedTo: serviceFollowups.assignedTo,
          status: serviceFollowups.status,
        })
        .from(serviceFollowups)
        .where(
          and(
            inArray(serviceFollowups.assignedTo, userIds),
            gte(serviceFollowups.createdAt, start),
            lte(serviceFollowups.createdAt, end),
          ),
        );

      const followByUser: Record<string, number> = {};
      const notFollowByUser: Record<string, number> = {};
      const notResponseByUser: Record<string, number> = {};
      for (const row of followupRows) {
        const key = row.assignedTo ? String(row.assignedTo) : null;
        if (!key) continue;
        if (row.status === "completed") followByUser[key] = (followByUser[key] ?? 0) + 1;
        else notFollowByUser[key] = (notFollowByUser[key] ?? 0) + 1;
        if (row.status === "missed") notResponseByUser[key] = (notResponseByUser[key] ?? 0) + 1;
      }

      // Renewals/upgrades within range, attributed back to the assigned rep
      // via service_customers (service_renewals has no user column itself).
      const renewalRows = await db
        .select({
          serviceCustomerId: serviceRenewals.serviceCustomerId,
          renewalType: serviceRenewals.renewalType,
          amount: serviceRenewals.amount,
        })
        .from(serviceRenewals)
        .where(and(gte(serviceRenewals.createdAt, start), lte(serviceRenewals.createdAt, end)));

      const upSellingByUser: Record<string, number> = {};
      const orderByUser: Record<string, number> = {};
      const revenueByUser: Record<string, number> = {};
      for (const row of renewalRows) {
        const userId = serviceCustomerToUser[row.serviceCustomerId];
        if (!userId) continue;
        const amt = Number(row.amount) || 0;
        revenueByUser[userId] = (revenueByUser[userId] ?? 0) + amt;
        if (row.renewalType === "upgrade") upSellingByUser[userId] = (upSellingByUser[userId] ?? 0) + 1;
        else orderByUser[userId] = (orderByUser[userId] ?? 0) + 1;
      }

      // Activities within range -> "Call Connected" (method mentions a call).
      const activityRows = await db
        .select({
          userId: serviceActivities.userId,
          method: serviceActivities.method,
        })
        .from(serviceActivities)
        .where(
          and(
            inArray(serviceActivities.userId, userIds),
            gte(serviceActivities.activityDate, start),
            lte(serviceActivities.activityDate, end),
          ),
        );

      const callConnectedByUser: Record<string, number> = {};
      for (const row of activityRows) {
        const key = row.userId ? String(row.userId) : null;
        if (!key) continue;
        const method = (row.method || "").toLowerCase();
        if (method.includes("call") || method.includes("mobile")) {
          callConnectedByUser[key] = (callConnectedByUser[key] ?? 0) + 1;
        }
      }

      // Appointments within range.
      const appointmentRows = await db
        .select({ userId: appointments.userId })
        .from(appointments)
        .where(
          and(
            inArray(appointments.userId, userIds),
            gte(appointments.startsAt, start),
            lte(appointments.startsAt, end),
          ),
        );

      const appointmentByUser: Record<string, number> = {};
      for (const row of appointmentRows) {
        const key = row.userId ? String(row.userId) : null;
        if (!key) continue;
        appointmentByUser[key] = (appointmentByUser[key] ?? 0) + 1;
      }

      // "Team Meeting" entries within range — the same drm.meetings rows the
      // Daily Team Meeting card reads.
      const meetingRows = await db
        .select({ userId: meetings.userId })
        .from(meetings)
        .where(
          and(
            inArray(meetings.userId, userIds),
            eq(meetings.meetingType, "Team Meeting"),
            gte(meetings.meetingDate, start),
            lte(meetings.meetingDate, end),
          ),
        );

      const meetingByUser: Record<string, number> = {};
      for (const row of meetingRows) {
        const key = row.userId ? String(row.userId) : null;
        if (!key) continue;
        meetingByUser[key] = (meetingByUser[key] ?? 0) + 1;
      }

      // "report": complaints + dropouts logged by the rep in range — the real
      // "Service Reports" tracking this codebase already has, reused instead
      // of inventing a parallel report entity.
      const reportByUser: Record<string, number> = {};
      const [complaintRows, dropoutRows] = await Promise.all([
        db.select({ createdBy: serviceComplaints.createdBy }).from(serviceComplaints).where(
          and(inArray(serviceComplaints.createdBy, userIds), gte(serviceComplaints.createdAt, start), lte(serviceComplaints.createdAt, end)),
        ),
        db.select({ createdBy: serviceDropouts.createdBy }).from(serviceDropouts).where(
          and(inArray(serviceDropouts.createdBy, userIds), gte(serviceDropouts.createdAt, start), lte(serviceDropouts.createdAt, end)),
        ),
      ]);
      for (const row of [...complaintRows, ...dropoutRows]) {
        const key = row.createdBy ? String(row.createdBy) : null;
        if (!key) continue;
        reportByUser[key] = (reportByUser[key] ?? 0) + 1;
      }

      // "startRating"/"happyAlibaba"/"happyWebxl": real customer-satisfaction
      // ratings recorded via POST /api/service/feedback, joined to the
      // customer's acquisition channel for the Alibaba/WebExcels split.
      const ratingRows = await db
        .select({
          createdBy: serviceCustomerFeedback.createdByUserId,
          rating: serviceCustomerFeedback.rating,
          source: customers.source,
        })
        .from(serviceCustomerFeedback)
        .leftJoin(customers, eq(serviceCustomerFeedback.customerId, customers.id))
        .where(
          and(
            inArray(serviceCustomerFeedback.createdByUserId, userIds),
            gte(serviceCustomerFeedback.createdAt, start),
            lte(serviceCustomerFeedback.createdAt, end),
          ),
        );

      const ratingSumByUser: Record<string, { sum: number; count: number }> = {};
      const happyAlibabaByUser: Record<string, number> = {};
      const happyWebxlByUser: Record<string, number> = {};
      for (const row of ratingRows) {
        const key = row.createdBy ? String(row.createdBy) : null;
        if (!key) continue;
        if (!ratingSumByUser[key]) ratingSumByUser[key] = { sum: 0, count: 0 };
        ratingSumByUser[key].sum += row.rating;
        ratingSumByUser[key].count += 1;
        if (row.rating >= 4) {
          if (row.source === "Alibaba") happyAlibabaByUser[key] = (happyAlibabaByUser[key] ?? 0) + 1;
          else if (row.source === "WebExcels") happyWebxlByUser[key] = (happyWebxlByUser[key] ?? 0) + 1;
        }
      }

      // "sample": sample requests logged by the rep in range.
      const sampleRows = await db
        .select({ createdBy: serviceSampleRequests.createdByUserId })
        .from(serviceSampleRequests)
        .where(
          and(
            inArray(serviceSampleRequests.createdByUserId, userIds),
            gte(serviceSampleRequests.createdAt, start),
            lte(serviceSampleRequests.createdAt, end),
          ),
        );
      const sampleByUser: Record<string, number> = {};
      for (const row of sampleRows) {
        const key = row.createdBy ? String(row.createdBy) : null;
        if (!key) continue;
        sampleByUser[key] = (sampleByUser[key] ?? 0) + 1;
      }

      const items = serviceUsers.map((user) => {
        const leads = leadsByUser[user.id] ?? 0;
        const follow = followByUser[user.id] ?? 0;
        const grades = gradeByUser[user.id] ?? { aMinus: 0, bPlus: 0, b: 0, bMinus: 0 };
        return {
          name: user.fullName || user.username,
          leads,
          follow,
          notFollow: notFollowByUser[user.id] ?? 0,
          aMinusCus: grades.aMinus,
          bPlusCus: grades.bPlus,
          bCus: grades.b,
          bMinusCsu: grades.bMinus,
          report: reportByUser[user.id] ?? 0,
          startRating: ratingSumByUser[user.id] ? Math.round((ratingSumByUser[user.id].sum / ratingSumByUser[user.id].count) * 10) / 10 : 0,
          upSelling: upSellingByUser[user.id] ?? 0,
          rfq: rfqByUser[user.id] ?? 0,
          products: productsByUser[user.id] ?? 0,
          followRate: leads > 0 ? Math.round((follow / leads) * 100) : 0,
          sample: sampleByUser[user.id] ?? 0,
          order: orderByUser[user.id] ?? 0,
          revenue: Math.round(revenueByUser[user.id] ?? 0),
          happyAlibaba: happyAlibabaByUser[user.id] ?? 0,
          happyWebxl: happyWebxlByUser[user.id] ?? 0,
          callConnected: callConnectedByUser[user.id] ?? 0,
          notResponse: notResponseByUser[user.id] ?? 0,
          appointment: appointmentByUser[user.id] ?? 0,
          meeting: meetingByUser[user.id] ?? 0,
        };
      });

      res.json(items);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch team work performance" });
    }
  });

  // "This month vas" achieved/target. There is no dedicated VAS-revenue table
  // for the service department (checked: only the sales-side vasProgressSnapshots
  // table has that shape, and it's unused/unpopulated) — serviceRenewals.amount
  // is the same real revenue figure /stats already sums as totalRevenue, and
  // is the most defensible real "achieved" number available today. Target is
  // the team's assigned serviceTargets.targetValue total, same source
  // /queue-performance already sums.
  app.get("/api/service/manager/vas-target", serviceManagerGate, async (req: Request, res: Response) => {
    try {
      const { from, to } = getPeriodRange(String(req.query.period ?? "MONTH"));
      const allowedUserIds = await getDepartmentFilterUserIds(req);

      const achievedRows = await db
        .select({ achieved: sql<number>`COALESCE(SUM(${serviceRenewals.amount}), 0)::float` })
        .from(serviceRenewals)
        .where(and(gte(serviceRenewals.createdAt, from), lte(serviceRenewals.createdAt, to)));
      const achieved = achievedRows[0]?.achieved ?? 0;

      let target = 0;
      if (!allowedUserIds || allowedUserIds.length > 0) {
        const targetConditions = allowedUserIds ? [inArray(serviceTargets.userId, allowedUserIds)] : [];
        const targetRows = await db
          .select({ target: sql<number>`COALESCE(SUM(${serviceTargets.targetValue}), 0)::float` })
          .from(serviceTargets)
          .where(and(...targetConditions));
        target = targetRows[0]?.target ?? 0;
      }

      const percent = target > 0 ? Math.round((achieved / target) * 100) : 0;
      res.json({ achieved, target, percent });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch VAS target" });
    }
  });

  // Real customer rows for the "Chart Data" pipeline widget. Only stages with
  // an unambiguous real signal on the service side are computed (NC/RC/EC from
  // service_customers life-cycle state, FW/NF from service_followups.status);
  // LD/QF/AY/IN/PM/GM/BV have no service-side equivalent (that enum only
  // exists on the sales `opportunities` pipeline, which service reps never
  // populate) — those return an explicit notTracked flag instead of a fake
  // empty-looking-like-zero-results list.
  const PIPELINE_NOT_TRACKED = new Set(["LD", "QF", "AY", "IN", "PM", "GM", "BV"]);
  app.get("/api/service/manager/pipeline-customers", serviceManagerGate, async (req: Request, res: Response) => {
    try {
      const stage = String(req.query.stage || "").toUpperCase();
      if (PIPELINE_NOT_TRACKED.has(stage)) {
        return res.json({ rows: [], notTracked: true });
      }
      if (!["NC", "RC", "EC", "FW", "NF"].includes(stage)) {
        return res.status(400).json({ error: "Unknown stage" });
      }

      const rows = await db
        .select({
          id: serviceCustomers.id,
          customerId: customers.id,
          drmId: customers.drmId,
          company: customers.companyName,
          accountName: customers.accountName,
          email: customers.email,
          phone: customers.phone,
          grade: customers.grade,
          createdAt: serviceCustomers.createdAt,
          status: serviceCustomers.status,
          expiryDate: serviceCustomers.expiryDate,
        })
        .from(serviceCustomers)
        .leftJoin(customers, eq(serviceCustomers.customerId, customers.id));

      let filtered = rows;
      if (stage === "NC") {
        filtered = rows.filter((r) => r.status === "active");
      } else if (stage === "RC") {
        filtered = rows.filter((r) => r.status === "renewed" || r.status === "upgraded");
      } else if (stage === "EC") {
        filtered = rows.filter((r) => computeExpiryState(r.expiryDate) === "expiring");
      } else {
        const followupRows = await db
          .select({ serviceCustomerId: serviceFollowups.serviceCustomerId, status: serviceFollowups.status })
          .from(serviceFollowups);
        const followedIds = new Set(
          followupRows.filter((f) => f.status === "completed").map((f) => f.serviceCustomerId),
        );
        filtered = stage === "FW"
          ? rows.filter((r) => followedIds.has(r.id))
          : rows.filter((r) => !followedIds.has(r.id));
      }

      res.json({
        rows: filtered.map((r) => ({
          id: r.customerId ?? r.id,
          drmId: r.drmId,
          company: r.company,
          account: r.accountName,
          email: r.email,
          phone: r.phone,
          grade: r.grade,
          createdAt: r.createdAt,
        })),
        notTracked: false,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch pipeline customers" });
    }
  });

  // Real GM/BV customer list for the "Customer Monthly" widget. isGoldMember/
  // isBusinessVerified are real columns on drm.customers, but checked: no
  // current workflow ever sets them to 1, so this will legitimately return an
  // empty list today for both types until something starts flipping those
  // flags — that's honest given real data, not a bug in this query.
  app.get("/api/service/manager/customers", serviceManagerGate, async (req: Request, res: Response) => {
    try {
      const type = String(req.query.type || "gm").toLowerCase();
      const allowedUserIds = await getDepartmentFilterUserIds(req);
      if (allowedUserIds && allowedUserIds.length === 0) {
        return res.json([]);
      }

      const flagColumn = type === "bv" ? customers.isBusinessVerified : customers.isGoldMember;
      const conditions = [eq(flagColumn, 1)];
      if (allowedUserIds) {
        conditions.push(inArray(serviceCustomers.assignedTo, allowedUserIds));
      }

      const rows = await db
        .select({
          id: customers.id,
          drmId: customers.drmId,
          company: customers.companyName,
          accountName: customers.accountName,
          email: customers.email,
          phone: customers.phone,
          ntn: customers.ntn,
          cnic: customers.cnic,
          grade: customers.grade,
          createdAt: customers.createdAt,
        })
        .from(serviceCustomers)
        .innerJoin(customers, eq(serviceCustomers.customerId, customers.id))
        .where(and(...conditions));

      const followCountRows = await db
        .select({
          customerId: serviceFollowups.customerId,
          count: sql<number>`count(${serviceFollowups.id})::int`,
        })
        .from(serviceFollowups)
        .groupBy(serviceFollowups.customerId);
      const followCounts: Record<string, number> = {};
      followCountRows.forEach((f) => { if (f.customerId) followCounts[f.customerId] = f.count; });

      res.json(rows.map((r) => ({ ...r, followCount: followCounts[r.id] ?? 0 })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Team executives, for the "assign to" picker when onboarding a company
  // into the service module — without this, onboarding always self-assigns
  // to whoever clicks Onboard, so the customer never shows up in any
  // executive's own in-service queue/appointment picker.
  app.get("/api/service/manager/team-executives", serviceManagerGate, async (req: Request, res: Response) => {
    try {
      let serviceUsers = await db.select({ id: users.id, fullName: users.fullName, username: users.username, roleId: users.roleId })
        .from(users)
        .where(sql`${users.roleId} ILIKE 'service_%'`);
      const allowedUserIds = await getDepartmentFilterUserIds(req);
      if (allowedUserIds) {
        const allowedSet = new Set(allowedUserIds);
        serviceUsers = serviceUsers.filter((u) => allowedSet.has(u.id));
      }
      res.json(serviceUsers.map((u) => ({ id: u.id, name: u.fullName || u.username, roleId: u.roleId })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch team executives" });
    }
  });
}
