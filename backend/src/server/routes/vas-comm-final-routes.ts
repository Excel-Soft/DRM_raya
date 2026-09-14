import type { Express, Request, Response } from "express";
import { db } from "../db";
import { webxlVasCommFinal, users } from "../../shared/schema";
import { eq, sql, and, desc, inArray, or } from "drizzle-orm";
import { getActiveRole } from "./services/auth-service";

export function registerVasCommFinalRoutes(app: Express) {
  // GET /api/drm/vas-comm-final
  app.get("/api/drm/vas-comm-final", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const roleId = (req.user as any)?.roleId || (req.user as any)?.activeRoleId;
      
      const currentDate = new Date();
      // Calculate current and previous month dynamically
      const currentMonthStr = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`;
      
      const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
      const prevMonthStr = `${prevDate.getFullYear()}-${prevDate.getMonth() + 1}`;

      // In the old system: role_id==32 (Account Manager), role_id==48 (HOD), otherwise (14 - Admin etc)
      // Since roleId might be a string now ('account_manager', 'hod', 'admin'), we map it
      
      let baseWhere = sql`${webxlVasCommFinal.commYear} || '-' || ${webxlVasCommFinal.commMonth} IN (${currentMonthStr}, ${prevMonthStr})`;
      
      // We also fetch data for tab1 (Commission Approved) and tab2 (Commission Not Approved) separately
      // but returning all relevant rows and letting frontend filter or backend filter based on a query param `tab`.
      const tab = req.query.tab as string; // 'approved' or 'not_approved'

      let roleCondition;
      if (roleId === 32 || roleId === "account_manager") {
        if (tab === 'approved') {
          roleCondition = sql`${webxlVasCommFinal.managerApprove}='Approved' AND ${webxlVasCommFinal.hodStatus}='Approved' AND ${webxlVasCommFinal.userStatus}='Verified' AND ${webxlVasCommFinal.accountPayStatus}='Pending'`;
        } else {
          roleCondition = sql`${webxlVasCommFinal.hodStatus}='Approved' AND (${webxlVasCommFinal.managerApprove}='Pending' OR ${webxlVasCommFinal.userStatus}='Pending') AND ${webxlVasCommFinal.finalPayAmount} > 0`;
        }
      } else if (roleId === 48 || roleId === "hod" || roleId === "super_hod") {
        if (tab === 'approved') {
          roleCondition = sql`${webxlVasCommFinal.managerApprove}='Approved' AND ${webxlVasCommFinal.hodStatus}='Pending'`;
        } else {
          roleCondition = sql`${webxlVasCommFinal.hodStatus}='Approved' AND (${webxlVasCommFinal.managerApprove}='Pending' OR ${webxlVasCommFinal.userStatus}='Pending') AND ${webxlVasCommFinal.finalPayAmount} > 0`;
        }
      } else { // admin (14) or others
        if (tab === 'approved') {
          roleCondition = sql`${webxlVasCommFinal.managerApprove}='Pending'`;
        } else {
          roleCondition = sql`${webxlVasCommFinal.hodStatus}='Approved' AND (${webxlVasCommFinal.managerApprove}='Pending' OR ${webxlVasCommFinal.userStatus}='Pending') AND ${webxlVasCommFinal.finalPayAmount} > 0`;
        }
      }

      const records = await db
        .select({
          id: webxlVasCommFinal.id,
          userId: webxlVasCommFinal.userId,
          managerApprove: webxlVasCommFinal.managerApprove,
          hodStatus: webxlVasCommFinal.hodStatus,
          userStatus: webxlVasCommFinal.userStatus,
          accountPayStatus: webxlVasCommFinal.accountPayStatus,
          commYear: webxlVasCommFinal.commYear,
          commMonth: webxlVasCommFinal.commMonth,
          commType: webxlVasCommFinal.commType,
          per: webxlVasCommFinal.per,
          comm: webxlVasCommFinal.comm,
          reward: webxlVasCommFinal.reward,
          teamReward: webxlVasCommFinal.teamReward,
          finalPayAmount: webxlVasCommFinal.finalPayAmount,
          personName: sql<string>`COALESCE(${users.name}, ${users.email}, '')`,
          totalAmount: sql<number>`(SELECT SUM(w.final_pay_amount) FROM webxl_vas_comm_final w WHERE w.user_id = ${webxlVasCommFinal.userId} AND w.comm_year || '-' || w.comm_month IN (${currentMonthStr}, ${prevMonthStr}))`
        })
        .from(webxlVasCommFinal)
        .leftJoin(users, eq(users.id, webxlVasCommFinal.userId))
        .where(and(baseWhere, roleCondition))
        .orderBy(webxlVasCommFinal.userId);

      res.json({ data: records });
    } catch (err) {
      console.error("[vas-comm-final] list error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to fetch vas comm finals" });
    }
  });

  // POST /api/drm/vas-comm-final/update
  app.post("/api/drm/vas-comm-final/update", async (req: Request, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const roleId = (req.user as any)?.roleId || (req.user as any)?.activeRoleId;
      
      const { id, userId, comStatus } = req.body;
      if (!id || !userId || !comStatus) {
        return res.status(400).json({ error: "BadRequest", message: "Missing required fields" });
      }

      if (comStatus === "Delete") {
        await db.delete(webxlVasCommFinal).where(and(eq(webxlVasCommFinal.id, id), eq(webxlVasCommFinal.userId, userId)));
        return res.json({ success: true, message: "Deleted successfully" });
      }

      let updatePayload: any = {};
      if (roleId === 32 || roleId === "account_manager") {
        updatePayload = { accountPayStatus: comStatus, accountPayDate: new Date() };
      } else if (roleId === 48 || roleId === "hod" || roleId === "super_hod") {
        updatePayload = { hodStatus: comStatus, hodStatusDate: new Date() };
      } else {
        updatePayload = { managerApprove: comStatus, managerApproveDate: new Date() };
      }

      await db.update(webxlVasCommFinal)
        .set(updatePayload)
        .where(and(eq(webxlVasCommFinal.id, id), eq(webxlVasCommFinal.userId, userId)));

      res.json({ success: true, message: "Updated successfully" });
    } catch (err) {
      console.error("[vas-comm-final] update error", err);
      res.status(500).json({ error: "InternalError", message: "Failed to update commission status" });
    }
  });
}
