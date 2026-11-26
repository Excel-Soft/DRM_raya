// Profile / Settings pages, user badges, force logout, account verification and login audit.
// Tables: scripts/migration/add-user-sessions-login-audit.sql
//
//   GET  /api/me/profile-full                 own profile + own recent logins
//   GET  /api/me/user-settings                own theme + Active status
//   PUT  /api/me/user-settings                { themeMode?, themeAccent?, statusActive? }
//   GET  /api/user-badges                     every user's { active (green/red tick), verified (blue tick) }
//   POST /api/admin/users/:id/force-logout    admin: end all of that user's sessions now
//   POST /api/admin/users/:id/account-verify  admin / accounts: { verified: boolean }
//   GET  /api/admin/login-audit               admin: login / logout history with IP + browser
import type { Express, Request, Response } from "express";
import { pool } from "../db";
import { normalizeRole, ROLES } from "../utils/role-utils";
import { recordLoginEvent, revokeUserSessions } from "../services/session-control.service";

const THEME_ACCENTS = ["green", "blue", "purple", "orange", "rose", "teal"];
const ACCOUNT_VERIFY_ROLES = ["account_manager", "accounts_assistant_manager"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const meId = (req: Request) => String((req.user as any)?.userId || "");
const userRoles = (req: Request): string[] => {
  const u = req.user as any;
  return [u?.activeRoleId, u?.roleId, ...(Array.isArray(u?.roles) ? u.roles : [])]
    .filter(Boolean)
    // raw key too: normalizeRole folds some keys (e.g. accounts_assistant_manager) into others
    .flatMap((r: string) => [String(r).trim().toLowerCase().replace(/\s+/g, "_"), normalizeRole(String(r))]);
};
/** Real admin (not while impersonating someone). */
const isAdmin = (req: Request) => !(req.user as any)?.impersonatorId && userRoles(req).includes(ROLES.ADMIN);
const canVerifyAccounts = (req: Request) =>
  isAdmin(req) || (!(req.user as any)?.impersonatorId && userRoles(req).some((r) => ACCOUNT_VERIFY_ROLES.includes(r)));

export function registerAccountSecurityRoutes(app: Express) {
  app.get("/api/me/profile-full", async (req: Request, res: Response) => {
    try {
      const id = meId(req);
      if (!id) return res.status(401).json({ error: "Not authenticated" });
      const { rows } = await pool.query(
        `SELECT u.id, coalesce(nullif(u.full_name, ''), u.name, u.username) AS "fullName", u.email, u.username,
                u.phone, u.department, u.designation, u.branch, u.country, u.role, u.roles,
                u.join_date AS "joinDate", u.attendance_id AS "attendanceId",
                u.shift_time_in AS "shiftTimeIn", u.shift_time_out AS "shiftTimeOut",
                u.gender, u.date_of_birth AS "dateOfBirth", u.address, u.created_at AS "createdAt",
                u.account_verified_at AS "accountVerifiedAt",
                coalesce(s.status_active, true) AS "statusActive"
           FROM drm.users u LEFT JOIN drm.user_settings s ON s.user_id = u.id
          WHERE u.id = $1`,
        [id],
      );
      if (!rows[0]) return res.status(404).json({ error: "User not found" });
      const logins = await pool.query(
        `SELECT id, event, reason, ip, browser, os, device, created_at AS "createdAt"
           FROM drm.login_audit WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [id],
      );
      res.json({ ...rows[0], recentLogins: logins.rows });
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.get("/api/me/user-settings", async (req: Request, res: Response) => {
    try {
      const id = meId(req);
      if (!id) return res.status(401).json({ error: "Not authenticated" });
      const { rows } = await pool.query(
        `SELECT theme_mode AS "themeMode", theme_accent AS "themeAccent", status_active AS "statusActive"
           FROM drm.user_settings WHERE user_id = $1`,
        [id],
      );
      res.json(rows[0] ?? { themeMode: null, themeAccent: "green", statusActive: true });
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/me/user-settings", async (req: Request, res: Response) => {
    try {
      const id = meId(req);
      if (!id) return res.status(401).json({ error: "Not authenticated" });
      if ((req.user as any)?.impersonatorId) return res.status(403).json({ error: "Not allowed while impersonating" });
      const b = req.body || {};
      const themeMode = b.themeMode === undefined ? null : String(b.themeMode);
      const themeAccent = b.themeAccent === undefined ? null : String(b.themeAccent);
      const statusActive = b.statusActive === undefined ? null : Boolean(b.statusActive);
      if (themeMode !== null && !["light", "dark"].includes(themeMode)) return res.status(400).json({ error: "Invalid theme" });
      if (themeAccent !== null && !THEME_ACCENTS.includes(themeAccent)) return res.status(400).json({ error: "Invalid color" });
      const { rows } = await pool.query(
        `INSERT INTO drm.user_settings (user_id, theme_mode, theme_accent, status_active)
         VALUES ($1, coalesce($2, 'light'), coalesce($3, 'green'), coalesce($4, true))
         ON CONFLICT (user_id) DO UPDATE SET
           theme_mode = coalesce($2, drm.user_settings.theme_mode),
           theme_accent = coalesce($3, drm.user_settings.theme_accent),
           status_active = coalesce($4, drm.user_settings.status_active),
           updated_at = now()
         RETURNING theme_mode AS "themeMode", theme_accent AS "themeAccent", status_active AS "statusActive"`,
        [id, themeMode, themeAccent, statusActive],
      );
      res.json(rows[0]);
    } catch (error) {
      console.error("Error saving user settings:", error);
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  app.get("/api/user-badges", async (_req: Request, res: Response) => {
    try {
      const { rows } = await pool.query(
        `SELECT u.id, coalesce(s.status_active, true) AS active, (u.account_verified_at IS NOT NULL) AS verified
           FROM drm.users u LEFT JOIN drm.user_settings s ON s.user_id = u.id`,
      );
      res.json({ items: rows });
    } catch (error) {
      console.error("Error fetching user badges:", error);
      res.status(500).json({ error: "Failed to fetch user badges" });
    }
  });

  app.post("/api/admin/users/:id/force-logout", async (req: Request, res: Response) => {
    try {
      if (!isAdmin(req)) return res.status(403).json({ error: "Only admin can force logout a user." });
      const target = String(req.params.id || "");
      if (!UUID_RE.test(target)) return res.status(400).json({ error: "Invalid user id" });
      if (target === meId(req)) return res.status(400).json({ error: "You cannot force logout yourself." });
      const exists = await pool.query("SELECT 1 FROM drm.users WHERE id = $1", [target]);
      if (!exists.rows[0]) return res.status(404).json({ error: "User not found" });
      await revokeUserSessions(target);
      await recordLoginEvent(req, { event: "forced_logout", userId: target, actorUserId: meId(req), reason: "Force logout by admin" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error forcing logout:", error);
      res.status(500).json({ error: "Failed to force logout" });
    }
  });

  app.post("/api/admin/users/:id/account-verify", async (req: Request, res: Response) => {
    try {
      if (!canVerifyAccounts(req)) return res.status(403).json({ error: "Only admin or Accounts can verify a user's account." });
      const target = String(req.params.id || "");
      if (!UUID_RE.test(target)) return res.status(400).json({ error: "Invalid user id" });
      const verified = Boolean(req.body?.verified);
      const { rowCount } = await pool.query(
        verified
          ? "UPDATE drm.users SET account_verified_at = now(), account_verified_by = $2 WHERE id = $1"
          : "UPDATE drm.users SET account_verified_at = NULL, account_verified_by = NULL WHERE id = $1 AND $2::uuid IS NOT NULL",
        [target, meId(req)],
      );
      if (!rowCount) return res.status(404).json({ error: "User not found" });
      res.json({ success: true, verified });
    } catch (error) {
      console.error("Error verifying account:", error);
      res.status(500).json({ error: "Failed to update verification" });
    }
  });

  app.get("/api/admin/login-audit", async (req: Request, res: Response) => {
    try {
      if (!isAdmin(req)) return res.status(403).json({ error: "Only admin can view the login audit." });
      const q = req.query as Record<string, string | undefined>;
      const page = Math.max(1, Number(q.page) || 1);
      const pageSize = Math.min(200, Math.max(10, Number(q.pageSize) || 50));
      const where: string[] = [];
      const params: any[] = [];
      const add = (sql: string, v: any) => { params.push(v); where.push(sql.replace("$?", `$${params.length}`)); };
      if (q.userId && UUID_RE.test(q.userId)) add("a.user_id = $?", q.userId);
      if (q.event && ["login_success", "login_failed", "logout", "forced_logout"].includes(q.event)) add("a.event = $?", q.event);
      if (q.from && /^\d{4}-\d{2}-\d{2}$/.test(q.from)) add("a.created_at >= $?::date", q.from);
      if (q.to && /^\d{4}-\d{2}-\d{2}$/.test(q.to)) add("a.created_at < ($?::date + 1)", q.to);
      if (q.search && q.search.trim()) {
        params.push(`%${q.search.trim()}%`);
        const p = `$${params.length}`;
        where.push(`(coalesce(u.full_name, '') ILIKE ${p} OR coalesce(u.email, '') ILIKE ${p}
                     OR coalesce(a.login_id, '') ILIKE ${p} OR coalesce(a.ip, '') ILIKE ${p} OR coalesce(a.browser, '') ILIKE ${p})`);
      }
      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
      const from = `FROM drm.login_audit a
                    LEFT JOIN drm.users u ON u.id = a.user_id
                    LEFT JOIN drm.users act ON act.id = a.actor_user_id`;
      const total = Number((await pool.query(`SELECT count(*) ${from} ${whereSql}`, params)).rows[0].count);
      const { rows } = await pool.query(
        `SELECT a.id, a.event, a.reason, a.ip, a.browser, a.os, a.device, a.user_agent AS "userAgent",
                a.login_id AS "loginId", a.created_at AS "createdAt", a.user_id AS "userId",
                coalesce(nullif(u.full_name, ''), u.name, u.username) AS "userName", u.email AS "userEmail",
                coalesce(nullif(act.full_name, ''), act.name) AS "actorName"
           ${from} ${whereSql}
          ORDER BY a.created_at DESC
          LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        params,
      );
      res.json({ total, page, pageSize, items: rows });
    } catch (error) {
      console.error("Error fetching login audit:", error);
      res.status(500).json({ error: "Failed to fetch login audit" });
    }
  });
}
