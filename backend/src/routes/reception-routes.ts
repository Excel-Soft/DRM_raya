import { Request, Response, Router } from "express";
import { db } from "../db";
import { 
  meetings, 
  meetingStatusEnum, 
  users, 
  customers, 
  notices,
  serviceComplaints
} from "../models";
import { eq, desc, and, sql, gte, lte, or, inArray, ilike } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Stats API
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "ld";
    const now = new Date();
    const dateTo = new Date(now);
    let dateFrom = new Date(now);

    switch (period.toLowerCase()) {
      case "td":
      case "ld": // default to today if ld
        dateFrom.setHours(0, 0, 0, 0);
        dateTo.setHours(23, 59, 59, 999);
        break;
      case "wc":
        dateFrom.setDate(now.getDate() - 7);
        break;
      case "mc":
        dateFrom.setDate(now.getDate() - 30);
        break;
      case "qc":
        dateFrom.setDate(now.getDate() - 90);
        break;
      case "yc":
        dateFrom.setDate(now.getDate() - 365);
        break;
      default:
        dateFrom.setHours(0, 0, 0, 0);
        dateTo.setHours(23, 59, 59, 999);
    }

    const [
      totalMeetingsRes,
      expectedTodayRes,
      interviewRes,
      noticesRes,
      totalClientsRes,
      complaintsRes,
      eventsRes
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(meetings)
        .where(
          and(
            gte(meetings.createdAt, dateFrom),
            lte(meetings.createdAt, dateTo)
          )
        ),
      db.select({ count: sql<number>`count(*)` })
        .from(meetings)
        .where(
          and(
            eq(meetings.status, "expected"),
            gte(meetings.meetingDate, dateFrom),
            lte(meetings.meetingDate, dateTo)
          )
        ),
      db.select({ count: sql<number>`count(*)` })
        .from(meetings)
        .where(
          and(
            eq(meetings.status, "in_progress"),
            gte(meetings.createdAt, dateFrom),
            lte(meetings.createdAt, dateTo)
          )
        ),
      db.select({ count: sql<number>`count(*)` })
        .from(notices)
        .where(eq(notices.status, "Active")),
      // Compute total clients (e.g. from unique companies in meetings)
      db.select({ count: sql<number>`count(distinct ${meetings.companyId})` })
        .from(meetings)
        .where(
          and(
            gte(meetings.createdAt, dateFrom),
            lte(meetings.createdAt, dateTo)
          )
        ),
      db.select({ count: sql<number>`count(*)` })
        .from(serviceComplaints)
        .where(
          or(
            eq(serviceComplaints.status, "open"),
            eq(serviceComplaints.status, "in_progress")
          )
        ),
      db.select({ count: sql<number>`count(*)` })
        .from(meetings)
        .where(
          and(
            or(
              inArray(meetings.meetingType, ["Seminar", "Webinar"]),
              ilike(meetings.meetingType, "%event%")
            ),
            gte(meetings.meetingDate, dateFrom),
            lte(meetings.meetingDate, dateTo)
          )
        )
    ]);

    const stats = {
      totalClients: Number(totalClientsRes[0]?.count || 0),
      totalMeetings: Number(totalMeetingsRes[0]?.count || 0),
      expectedClients: Number(expectedTodayRes[0]?.count || 0),
      interviewClients: Number(interviewRes[0]?.count || 0),
      noticesCount: Number(noticesRes[0]?.count || 0),
      complaintsCount: Number(complaintsRes[0]?.count || 0), 
      eventCount: Number(eventsRes[0]?.count || 0),
      loginTime: req.user ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : "00:00"
    };

    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching reception stats:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

// Get meetings with pagination and filtering
router.get("/meetings", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as "expected" | "in_progress" | "ended" | undefined;
    // Optional filters (additive, backward-compatible — existing callers that
    // don't pass them are unaffected):
    //  - personType: distinguishes internal "user" meetings (e.g. HOD scheduling
    //    with a colleague) from reception's client "contact"/"external" visits.
    //  - date: restricts to a single calendar day of meetingDate (YYYY-MM-DD).
    const personType = req.query.personType as "user" | "contact" | "external" | undefined;
    const dateParam = req.query.date as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    let conditions = [];
    if (status) {
      conditions.push(eq(meetings.status, status));
    }
    if (personType) {
      conditions.push(eq(meetings.personType, personType));
    }
    if (dateParam) {
      const dayStart = new Date(dateParam);
      if (!isNaN(dayStart.getTime())) {
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        conditions.push(gte(meetings.meetingDate, dayStart));
        conditions.push(lte(meetings.meetingDate, dayEnd));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select({
        id: meetings.id,
        companyId: meetings.companyId,
        companyName: customers.companyName,
        personType: meetings.personType,
        userId: meetings.userId,
        meetingType: meetings.meetingType,
        personName: meetings.personName,
        status: meetings.status,
        meetingDate: meetings.meetingDate,
        scheduledTime: meetings.scheduledTime,
        startTime: meetings.startTime,
        endTime: meetings.endTime,
        totalDurationSeconds: meetings.totalDurationSeconds,
        fileUrl: meetings.fileUrl,
      })
      .from(meetings)
      .leftJoin(customers, eq(meetings.companyId, customers.id))
      .where(whereClause)
      .orderBy(desc(meetings.createdAt))
      .limit(limit)
      .offset(offset);

    // Get count for pagination
    const countRes = await db.select({ count: sql<number>`count(*)` })
      .from(meetings)
      .where(whereClause);
      
    res.json({
      data,
      metadata: {
        total: Number(countRes[0]?.count || 0),
        page,
        limit
      }
    });
  } catch (error: any) {
    console.error("Error fetching meetings:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

const createMeetingSchema = z.object({
  companyId: z.string().uuid().optional(),
  personType: z.enum(["user", "contact", "external"]).default("contact"),
  userId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  personName: z.string().optional(),
  meetingType: z.string(),
  scheduledTime: z.string().optional(),
  lastContactTime: z.string().optional(),
});

router.post("/meetings", async (req: Request, res: Response) => {
  try {
    const data = createMeetingSchema.parse(req.body);
    
    // Default createdBy and updatedBy if req.user is set via auth middleware
    const userId = (req as any).user?.id || null;

    const [newMeeting] = await db.insert(meetings).values({
      ...data,
      status: "expected",
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    res.status(201).json({ success: true, data: newMeeting });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Error creating meeting:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

router.patch("/meetings/:id/start", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || null;

    // We can use a transaction as requested for safety
    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(meetings).where(eq(meetings.id, id));
      if (!existing) {
        throw new Error("Meeting not found");
      }
      if (existing.status !== "expected") {
        throw new Error("Only meetings in 'expected' status can be started");
      }

      await tx.update(meetings)
        .set({
          status: "in_progress",
          startTime: new Date(),
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(meetings.id, id));
    });

    res.json({ success: true, message: "Meeting started successfully" });
  } catch (error: any) {
    console.error("Error starting meeting:", error);
    res.status(400).json({ success: false, error: error.message || "Internal server error" });
  }
});

router.patch("/meetings/:id/end", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || null;

    await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(meetings).where(eq(meetings.id, id));
      
      if (!existing) {
        throw new Error("Meeting not found");
      }
      if (existing.status !== "in_progress") {
        throw new Error("Only meetings in 'in_progress' status can be ended");
      }
      if (!existing.startTime) {
        throw new Error("Meeting start time is missing");
      }

      const endTime = new Date();
      // Calculate total duration in seconds securely
      const totalDurationSeconds = Math.floor((endTime.getTime() - existing.startTime.getTime()) / 1000);

      await tx.update(meetings)
        .set({
          status: "ended",
          endTime,
          totalDurationSeconds,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(meetings.id, id));
    });

    res.json({ success: true, message: "Meeting ended successfully" });
  } catch (error: any) {
    console.error("Error ending meeting:", error);
    res.status(400).json({ success: false, error: error.message || "Internal server error" });
  }
});

// Handle File uploads reference attachment to meeting
router.patch("/meetings/:id/file", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { fileUrl } = req.body;
        
        if (!fileUrl) {
            return res.status(400).json({ success: false, error: "fileUrl is required" });
        }
        
        await db.update(meetings)
            .set({ fileUrl, updatedAt: new Date() })
            .where(eq(meetings.id, id));
            
        res.json({ success: true, message: "File attached successfully" });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message || "Internal server error" });
    }
});

export default router;
