import { Express, Request, Response } from "express";
import { z } from "zod";

import { requireRole } from "../middleware/auth.middleware";
import { db, pool } from "../db";
import {
  serviceCustomers,
  serviceActivities,
  serviceTargets,
  serviceFollowups,
  appointments,
  customers,
  services,
  opportunities,
  serviceComplaints,
  serviceDropouts,
  targetSystemDailyTargets,
  targetSystemUserTargets,
  users
} from "../../shared/schema";
import { eq, and, sql, gte, lte, desc, inArray } from "drizzle-orm";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { computeExpiryState } from "../utils/service-expiry";
import { opportunitiesRepository } from "../repositories/opportunities.repository";
import { appointmentsRepository } from "../repositories/appointments.repository";
import { servicesRepository } from "../repositories/services.repository";
import { bucketServiceKpis } from "../utils/service-kpi";
import { getPeriodRange } from "./dashboard-routes";

export function registerServiceExecutiveRoutes(app: Express) {
  // Mirrors the Service Manager module's own gate (Phase 16 / SRV-002):
  // these endpoints previously had no role restriction beyond global auth.
  const serviceExecutiveGate = requireRole("service_executive", "admin");

  // Statistics for Executive top cards
  app.get("/api/service/executive/stats", serviceExecutiveGate, async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      // The dashboard's TD/WC/MC/QC/YC/OverAll dropdown was previously never
      // read here — every period returned the exact same all-time totals.
      const { from, to } = getPeriodRange(String(req.query.period ?? "WC"));

      // Joined with the parent `customers` row so we can read both `grade`
      // (unused here) and `service_types` — the same column dashboard-routes.ts
      // uses for the Sales-side VM/KWA/PSA/Sponsor KPIs. service_customers has
      // no such column of its own.
      const rows = await db
        .select({
          serviceCustomer: serviceCustomers,
          customerServiceTypes: customers.serviceTypes,
        })
        .from(serviceCustomers)
        .leftJoin(customers, eq(serviceCustomers.customerId, customers.id))
        .where(and(
          eq(serviceCustomers.assignedTo, execId),
          gte(serviceCustomers.createdAt, from),
          lte(serviceCustomers.createdAt, to),
        ));

      const customerIds = Array.from(
        new Set(rows.map((r) => r.serviceCustomer.customerId).filter((id): id is string => Boolean(id))),
      );

      // Revenue attribution: the amount tied to the underlying customer's
      // sales opportunities (the same "value" figure dashboard-routes.ts sums
      // for its own VM/KWA/PSA/Sponsor amounts) — service_customers/renewals
      // don't carry a per-record revenue figure of their own.
      const amountByCustomer: Record<string, number> = {};
      if (customerIds.length > 0) {
        const oppRows = await db
          .select({ customerId: opportunities.customerId, amount: opportunities.amount })
          .from(opportunities)
          .where(and(inArray(opportunities.customerId, customerIds), eq(opportunities.isDeleted, false)));
        for (const o of oppRows) {
          const amt = Number(o.amount) || 0;
          amountByCustomer[o.customerId] = (amountByCustomer[o.customerId] ?? 0) + amt;
        }
      }

      let newCount = 0, newAmount = 0;
      let renewCount = 0, renewAmount = 0;
      let expireCount = 0, expireAmount = 0;
      let activeCount = 0;
      let totalAmount = 0;

      for (const row of rows) {
        const cust = row.serviceCustomer;
        const amt = amountByCustomer[cust.customerId] ?? 0;
        totalAmount += amt;

        const state = computeExpiryState(cust.expiryDate);
        if (state === "active") activeCount++;
        if (state === "expiring") { expireCount++; expireAmount += amt; }

        // `status` records the last life-cycle transition recorded against the
        // service record — 'renewed'/'upgraded' means a renewal action already
        // happened, anything else still on its original ('active') cycle counts
        // as "new".
        if (cust.status === "renewed" || cust.status === "upgraded") { renewCount++; renewAmount += amt; }
        else if (cust.status === "active") { newCount++; newAmount += amt; }
      }

      const kpi = bucketServiceKpis(
        rows.map((r) => ({
          serviceTypes: r.customerServiceTypes,
          amount: amountByCustomer[r.serviceCustomer.customerId] ?? 0,
        })),
      );

      res.json({
        totalContact: { count: rows.length, amount: Math.round(totalAmount) },
        new: { count: newCount, amount: Math.round(newAmount) },
        renew: { count: renewCount, amount: Math.round(renewAmount) },
        expire: { count: expireCount, amount: Math.round(expireAmount) },
        inService: activeCount,
        vm: { count: kpi.vm.count, amount: Math.round(kpi.vm.amount) },
        kwa: { count: kpi.kwa.count, amount: Math.round(kpi.kwa.amount) },
        psa: { count: kpi.psa.count, amount: Math.round(kpi.psa.amount) },
        sponsor: { count: kpi.sponsor.count, amount: Math.round(kpi.sponsor.amount) },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // User's Activity Breakdown
  app.get("/api/service/executive/activities", serviceExecutiveGate, async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      // Dropdown was previously fixed to "today" regardless of what the
      // client sent, and the real activity rows fetched below were never
      // actually used in the response (always 0 time / 0%).
      const { from: s, to: e } = getPeriodRange(String(req.query.period ?? "TD"));

      const activities = await db.select()
        .from(serviceActivities)
        .where(
          and(
            eq(serviceActivities.userId, execId),
            gte(serviceActivities.activityDate, s),
            lte(serviceActivities.activityDate, e)
          )
        );

      const methodStats: Record<string, { count: number; minutes: number }> = {};
      for (const a of activities) {
        const key = a.method;
        if (!methodStats[key]) methodStats[key] = { count: 0, minutes: 0 };
        methodStats[key].count += 1;
        methodStats[key].minutes += a.durationMinutes || 0;
      }

      let defaultActivities = [
        { method: "Mobile", target: "15 () 0%", time: 0 },
        { method: "OnSite Visit", target: "1 () 0%", time: 0 },
        { method: "Whatsapp", target: "20 () 0%", time: 0 },
        { method: "VAS Call", target: "5 () 0%", time: 0 },
        { method: "E-mail", target: "5 () 0%", time: 0 },
        { method: "Webinar", target: "1 () 0%", time: 0 },
        { method: "Seminar", target: "1 () 0%", time: 0 },
        { method: "Copy Product", target: "10 () 0%", time: 0 },
        { method: "New Product", target: "5 () 0%", time: 0 },
        { method: "ShowCase", target: "5 () 0%", time: 0 },
      ];

      // This endpoint is specifically for the Service Executive dashboard.
      // If an Admin views this dashboard, we still want to show Service Executive targets.
      const targetRoleName = "service executive";

      const allTargets = await db.select().from(targetSystemDailyTargets);
      const roleTargets = allTargets.filter(t => t.role.replace(/_/g, ' ').toLowerCase() === targetRoleName);

      defaultActivities = defaultActivities.map(act => {
        const match = roleTargets.find(t => t.method.toLowerCase().includes(act.method.toLowerCase()) || act.method.toLowerCase().includes(t.method.toLowerCase()));
        const targetNum = match ? Number(match.target) : Number(act.target.split(" ")[0]) || 0;
        const stat = methodStats[act.method] || { count: 0, minutes: 0 };
        const percent = targetNum > 0 ? Math.round((stat.count / targetNum) * 100) : 0;
        return { method: act.method, target: `${targetNum} (${stat.count}) ${percent}%`, time: stat.minutes };
      });

      res.json(defaultActivities);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // User Targets vs Achievement
  app.get("/api/service/executive/targets", serviceExecutiveGate, async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      
      const targetRoleName = "service_executive";
      
      // Get a valid service executive ID if the current user isn't one (for admin views)
      let targetUserId = execId;
      const currentUser = await db.select().from(users).where(eq(users.id, execId)).limit(1);
      if (currentUser[0]?.role !== targetRoleName) {
        const serviceExec = await db.select().from(users).where(eq(users.role, targetRoleName)).limit(1);
        if (serviceExec.length > 0) {
          targetUserId = serviceExec[0].id;
        }
      }

      // Fetch targets from the master table (both user and role)
      const allTargetsRes = await db.select().from(targetSystemUserTargets);
      
      const allTargets = allTargetsRes.filter(t => 
        t.userId === targetUserId || t.userId === targetRoleName
      );
      
      const ab = allTargets.filter(t => t.category && t.category.toLowerCase().includes("ab new")).map(t => ({
        target: `${t.targetName} [${t.target || 0}]`,
        bonus: t.bonus,
        price: t.price,
        reward: t.reward,
        kwa: t.kwa,
        vas: t.vas
      }));

      const vas = allTargets.filter(t => t.category && t.category.toLowerCase().includes("vas")).map(t => ({
        target: `${t.targetName} [${t.target || 0}]`,
        bonus: t.bonus,
        price: t.price,
        reward: t.reward
      }));

      const stageCounts = await opportunitiesRepository.countByStage(targetUserId);
      const overall = [
          { name: "LD", value: stageCounts["LD"] || 0 },
          { name: "QF", value: stageCounts["QF"] || 0 },
          { name: "AY", value: stageCounts["AY"] || 0 },
          { name: "IN", value: stageCounts["IN"] || 0 },
          { name: "PM", value: stageCounts["PM"] || 0 },
          { name: "GM", value: stageCounts["GM"] || 0 },
          { name: "BV", value: stageCounts["BV"] || 0 },
          { name: "NC", value: stageCounts["NC"] || 0 },
          { name: "RC", value: stageCounts["RC"] || 0 },
          { name: "EC", value: stageCounts["EC"] || 0 },
          { name: "FW", value: stageCounts["FW"] || 0 },
          { name: "NF", value: stageCounts["NF"] || 0 },
      ];

      res.json({
        ab,
        vas,
        overall
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch targets" });
    }
  });

  // Appointments — mirrors /api/sales/appointments' two shapes via the same
  // ?all=true switch: today-only (plain array, for the TodayAppointment card)
  // vs. the full book (`{ data, meta }`, for the create/manage modal).
  app.get("/api/service/executive/appointments", serviceExecutiveGate, async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      const isAll = req.query.all === "true";

      const list = isAll
        ? await appointmentsRepository.findByUserId(execId)
        : await appointmentsRepository.getTodayAppointments(execId);

      const formatted = list.map((apt: any) => {
        const time = apt.startsAt
          ? new Date(apt.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
          : "";
        return {
          id: apt.id,
          company: apt.customer?.company_name || apt.customer?.companyName || "Unknown",
          purpose: apt.notes || "Meeting",
          time,
          startsAt: apt.startsAt ? new Date(apt.startsAt).toISOString() : null,
          endsAt: apt.endsAt ? new Date(apt.endsAt).toISOString() : null,
          meetingBy: "Self",
        };
      });

      if (isAll) {
        res.json({ data: formatted, meta: { total: formatted.length } });
      } else {
        res.json(formatted);
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  // Create an appointment tied to one of this executive's own service
  // customers (mirrors POST /api/sales/appointments' validation/shape).
  app.post("/api/service/executive/appointments", serviceExecutiveGate, async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      const { customerId, purpose, date, time, location } = req.body || {};
      const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
      if (!customerId || !uuidPattern.test(String(customerId))) {
        return res.status(400).json({ error: "Valid customerId (uuid) is required" });
      }
      if (!date || Number.isNaN(Date.parse(date))) {
        return res.status(400).json({ error: "Valid date (YYYY-MM-DD) is required" });
      }
      const startsAt = new Date(`${date}T${time || "00:00"}`);
      const created = await appointmentsRepository.create({
        userId: execId,
        customerId,
        startsAt,
        notes: purpose,
        location,
      });
      res.status(201).json(created);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  // End an appointment (own records only).
  app.patch("/api/service/executive/appointments/:id/end", serviceExecutiveGate, async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      const { id } = req.params;
      const result = await pool.query(
        `update drm.appointments set ends_at = now() where id = $1 and assigned_to = $2 returning *`,
        [id, execId],
      );
      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to end appointment" });
    }
  });

  // "Follow The Customer" — writes to the same drm.follow_ups (+
  // followup_services/followup_subservices/followup_subservice_details)
  // tables the Sales equivalent (POST /api/sales/followups) writes to, which
  // is exactly what GET /api/dashboard/followups reads for the Service
  // Executive dashboard's "Follow Up Details" table (confirmed: purpose/
  // grade/method/notes/dueAt all round-trip through those same tables/
  // columns). A dedicated endpoint (rather than reusing /api/sales/followups)
  // is needed because that route's ownership check (assertCanEditCustomer)
  // requires the caller to be the customer's Sales owner_user_id, which a
  // service executive normally is not — it would 403. Ownership here is
  // instead scoped to the executive's own drm.service_customers assignment.
  //
  // Accepts multiple services/sub-services per submission (one
  // followup_subservice_details row each), matching func.php's real
  // "LatestfollowupMethod" handler — the previous single-subServiceId version
  // this replaced only ever exposed 2-3 of the real catalog's 5 top-level
  // services because the picker hard-restricted the list client-side.
  const reservationCodes = new Set(["MOBILE", "W_CALL", "ON_SITE_APPOINTMENT", "E_MAIL", "VM_APPOINTMENT", "FAX", "NO_NEED"]);
  // "Review" multi-select checklist added to the "Follow The Customer" form.
  // No existing column on drm.followup_subservice_details fits (comment is a
  // genuinely distinct field written by the Sales follow-up flow) so a new
  // nullable `review` text column is added here, idempotently, the same way
  // sales-routes.ts's ensureFollowupDetailsTables() evolves this table. Kept
  // submission-wide (not per sub-service) since the form only ever presented
  // it as a single shared checklist.
  const FOLLOW_REVIEW_OPTIONS = new Set([
    "Report", "Start Rating", "Up Selling", "Rfq", "Products", "Follow Rate",
    "Sample", "Order", "Revenue", "Happay With Alibaba", "Happay With Webxl",
  ]);
  let ensuredFollowupReviewColumn = false;
  async function ensureFollowupReviewColumn() {
    if (ensuredFollowupReviewColumn) return;
    await pool.query(`alter table drm.followup_subservice_details add column if not exists review text null`);
    ensuredFollowupReviewColumn = true;
  }

  const followUpDetailSchema = z.object({
    subServiceId: z.string().uuid(),
    purpose: z.string().trim().min(1),
    grade: z.string().trim().min(1),
    method: z.string().trim().min(1),
    comment: z.string().trim().min(1),
    note: z.string().trim().min(1),
    dateTime: z.string().trim().optional(),
    talkTimeMinutes: z.number().int().min(1).max(600).optional().nullable(),
  });
  const followUpCreateSchema = z.object({
    customerId: z.string().uuid(),
    subServiceDetails: z.array(followUpDetailSchema).min(1, "At least one service must be selected"),
    review: z.array(z.string()).min(1),
    note: z.string().trim().optional(),
    nextDate: z.string().trim().optional(),
    method: z.string().trim().max(50).optional(),
    reservationType: z.string().trim().optional(),
  });

  // AI Services' real sub-services (AI Cloud CRM, AI RAG ChatBot, etc.) carry
  // a 60-day exclusivity lock per func.php's "LatestfollowupMethod" handler:
  // once one rep follows up on a given AI sub-service for a company, no other
  // rep can touch that same sub-service for 60 days, and selecting the "AI
  // Bundel" sub-service locks out every other AI sub-service for that
  // company (and vice versa) for the same window. No other service (Alibaba
  // Membership/Services, Design Development, Domain Hosting) has this rule in
  // the legacy source — scoped here to service_code === 'AI_SERVICES' only.
  const AI_SERVICES_CODE = "AI_SERVICES";
  const AI_BUNDEL_CODE = "AI_BUNDEL";

  app.post("/api/service/executive/follow-ups", serviceExecutiveGate, async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      const parsed = followUpCreateSchema.parse(req.body || {});

      if (!parsed.review.every((r) => FOLLOW_REVIEW_OPTIONS.has(r))) {
        return res.status(400).json({ error: "review contains an invalid option", allowed: Array.from(FOLLOW_REVIEW_OPTIONS) });
      }
      const reviewValue = parsed.review.join(", ");

      let reservationNormalized: string | undefined;
      if (parsed.reservationType) {
        reservationNormalized = parsed.reservationType.trim().toUpperCase().replace(/[\s-]+/g, "_");
        if (!reservationCodes.has(reservationNormalized)) {
          return res.status(400).json({ error: "Invalid reservationType", allowed: Array.from(reservationCodes) });
        }
      }

      // Scope check: this executive must legitimately be connected to the
      // target customer via one of the two (disjoint) service-assignment
      // mechanisms in this codebase — either a drm.service_customers row
      // assigned to them (the original/"in-service" picker path), OR a
      // drm.service_pool_entries row where they are the assigned Service
      // Person (the Service Pool page's separate assignment concept, set by
      // servicePoolRepository.assign/transfer). Without the second check,
      // follow-ups submitted for a customer clicked from the Service Pool
      // page's ID column would always 403 here, since assign/transfer never
      // touch drm.service_customers.
      const ownedViaServiceCustomers = await db
        .select({ id: serviceCustomers.id })
        .from(serviceCustomers)
        .where(and(eq(serviceCustomers.customerId, parsed.customerId), eq(serviceCustomers.assignedTo, execId)))
        .limit(1);
      let owned = ownedViaServiceCustomers.length > 0;
      if (!owned) {
        const ownedViaPool = await pool.query(
          `select 1 from drm.service_pool_entries where customer_id = $1 and service_person_id = $2 limit 1`,
          [parsed.customerId, execId],
        );
        owned = (ownedViaPool.rowCount ?? 0) > 0;
      }
      if (!owned) {
        return res.status(403).json({ error: "This customer is not in your service pool" });
      }

      const subServiceIds = Array.from(new Set(parsed.subServiceDetails.map((d) => d.subServiceId)));
      const subs = await servicesRepository.findSubservicesByIds(subServiceIds);
      if (subs.length !== subServiceIds.length) {
        const foundIds = new Set(subs.map((s) => s.id));
        return res.status(400).json({
          error: "INVALID_SUBSERVICES",
          invalid: subServiceIds.filter((id) => !foundIds.has(id)),
        });
      }
      const subsById = new Map(subs.map((s) => [s.id, s]));

      const dueAt = parsed.nextDate && !Number.isNaN(Date.parse(parsed.nextDate)) ? new Date(parsed.nextDate) : new Date();
      await ensureFollowupReviewColumn();

      const client = await pool.connect();
      try {
        await client.query("begin");

        const lockedDetails: Array<{ subServiceId: string; name: string; reason: string }> = [];
        const validDetails: typeof parsed.subServiceDetails = [];
        const bundleInThisSubmission = subServiceIds.some((id) => subsById.get(id)?.code === AI_BUNDEL_CODE);

        for (const detail of parsed.subServiceDetails) {
          const meta = subsById.get(detail.subServiceId)!;
          if (meta.serviceCode === AI_SERVICES_CODE) {
            const lockRes = await client.query(
              `select f.created_by, u.name
                 from drm.followup_subservice_details d
                 join drm.follow_ups f on f.id = d.followup_id
                 left join drm.users u on u.id = f.created_by
                where f.customer_id = $1 and d.subservice_id = $2
                  and d.created_at >= now() - interval '60 days'
                order by d.created_at desc limit 1`,
              [parsed.customerId, meta.id],
            );
            const lockRow = lockRes.rows[0] as { created_by: string; name: string | null } | undefined;
            if (lockRow && lockRow.created_by !== execId) {
              lockedDetails.push({ subServiceId: meta.id, name: meta.name, reason: `locked by ${lockRow.name || "another user"}` });
              continue;
            }

            if (meta.code !== AI_BUNDEL_CODE) {
              const bundleRes = await client.query(
                `select 1
                   from drm.followup_subservice_details d
                   join drm.follow_ups f on f.id = d.followup_id
                   join drm.service_subservices ss on ss.id = d.subservice_id
                  where f.customer_id = $1 and ss.code = $2
                    and d.created_at >= now() - interval '60 days'
                  limit 1`,
                [parsed.customerId, AI_BUNDEL_CODE],
              );
              if ((bundleRes.rowCount ?? 0) > 0) {
                lockedDetails.push({ subServiceId: meta.id, name: meta.name, reason: "locked because AI Bundel is already active for this company" });
                continue;
              }
              if (bundleInThisSubmission) {
                lockedDetails.push({ subServiceId: meta.id, name: meta.name, reason: "locked because AI Bundel is selected in this submission" });
                continue;
              }
            }
          }
          validDetails.push(detail);
        }

        if (validDetails.length === 0) {
          await client.query("rollback");
          return res.status(409).json({ error: "ALL_SERVICES_LOCKED", locked: lockedDetails });
        }

        const followupResult = await client.query(
          `insert into drm.follow_ups (customer_id, assigned_to, created_by, due_at, status, notes, method, reservation_type, talk_time_seconds, date_time, created_at, updated_at, is_deleted)
             values ($1, $2, $2, $3, 'Open', $4, $5, $6, 0, $3, now(), now(), false)
             returning *`,
          [parsed.customerId, execId, dueAt, parsed.note ?? null, parsed.method ?? null, reservationNormalized ?? null],
        );
        const followup = followupResult.rows[0];

        const serviceIds = Array.from(new Set(validDetails.map((d) => subsById.get(d.subServiceId)!.serviceId)));
        for (const serviceId of serviceIds) {
          await client.query(
            `insert into drm.followup_services (followup_id, service_id) values ($1, $2) on conflict do nothing`,
            [followup.id, serviceId],
          );
        }
        for (const detail of validDetails) {
          const meta = subsById.get(detail.subServiceId)!;
          await client.query(
            `insert into drm.followup_subservices (followup_id, subservice_id) values ($1, $2) on conflict do nothing`,
            [followup.id, meta.id],
          );
          const activityAt = detail.dateTime && !Number.isNaN(Date.parse(detail.dateTime)) ? new Date(detail.dateTime) : dueAt;
          await client.query(
            `insert into drm.followup_subservice_details
              (followup_id, service_id, subservice_id, service_code, subservice_code, purpose, grade, method, comment, note, talk_time_minutes, activity_at, review)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              followup.id, meta.serviceId, meta.id, meta.serviceCode, meta.code,
              detail.purpose, detail.grade, detail.method, detail.comment, detail.note,
              detail.talkTimeMinutes ?? null, activityAt, reviewValue,
            ],
          );
        }

        await client.query("update drm.customers set last_followup_date = $1 where id = $2", [dueAt, parsed.customerId]);

        await client.query("commit");
        res.status(201).json({ success: true, data: followup, locked: lockedDetails.length ? lockedDetails : undefined });
      } catch (err) {
        await client.query("rollback");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid follow-up request", details: err.errors });
      }
      console.error(err);
      res.status(500).json({ error: "Failed to create follow-up" });
    }
  });

  // Customer Queue Data (In-Service, Expiring)
  app.get("/api/service/executive/customers/:filter", serviceExecutiveGate, async (req: Request, res: Response) => {
    try {
      const execId = req.user!.userId || (req.user as any)!.id;
      const { filter } = req.params; // 'in-service', 'expiring', 'expired'
      // Optional pool_type constraint (e.g. "Service"), mirroring
      // buildLeadPoolList's "service" case in sales-routes.ts. Only applied
      // when explicitly requested via ?poolType=, so existing consumers of
      // this endpoint (In-Service modal, ImportantMetrics) that intentionally
      // show every assigned service customer regardless of pool are untouched.
      const poolType = typeof req.query.poolType === "string" ? req.query.poolType : undefined;

      const whereConditions = [eq(serviceCustomers.assignedTo, execId)];
      if (poolType) whereConditions.push(eq(customers.poolType, poolType));

      const results = await db.select({
        serviceCustomer: serviceCustomers,
        customerDetails: customers,
        packageDetails: services
      })
      .from(serviceCustomers)
      .leftJoin(customers, eq(serviceCustomers.customerId, customers.id))
      .leftJoin(services, eq(serviceCustomers.packageId, services.id))
      .where(and(...whereConditions));

      // Filter by dynamic expiry state in memory
      const filtered = results.filter(r => {
        const state = computeExpiryState(r.serviceCustomer.expiryDate);
        if (filter === "expiring") return state === "expiring";
        if (filter === "expired") return state === "expired";
        return state === "active"; // defaults to in-service
      });

      res.json(filtered);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch filtered customers" });
    }
  });
}
