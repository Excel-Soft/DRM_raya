// Force logout + login audit helpers (scripts/migration/add-user-sessions-login-audit.sql).
//
// Force logout: drm.users.sessions_revoked_at. A token whose iat is before that moment is
// rejected by authMiddleware. Looked up per user with a short in-process cache so a normal
// request does not hit the DB every time.
import type { Request } from "express";
import { pool } from "../db";

const CACHE_MS = 15_000;
const revokedCache = new Map<string, { revokedAtMs: number | null; until: number }>();

async function revokedAtMs(userId: string): Promise<number | null> {
  const now = Date.now();
  const hit = revokedCache.get(userId);
  if (hit && hit.until > now) return hit.revokedAtMs;
  const { rows } = await pool.query(
    "SELECT sessions_revoked_at FROM drm.users WHERE id::text = $1",
    [userId],
  );
  const v = rows[0]?.sessions_revoked_at ? new Date(rows[0].sessions_revoked_at).getTime() : null;
  revokedCache.set(userId, { revokedAtMs: v, until: now + CACHE_MS });
  return v;
}

/** True when an admin ended this user's sessions after the token was issued. */
export async function isTokenRevoked(userId: string, iatSeconds: number | undefined): Promise<boolean> {
  if (!userId || !iatSeconds) return false;
  const revoked = await revokedAtMs(String(userId));
  if (!revoked) return false;
  return iatSeconds < Math.floor(revoked / 1000);
}

/** End every session of a user now (tokens issued before this moment stop working). */
export async function revokeUserSessions(userId: string): Promise<void> {
  const { rows } = await pool.query(
    "UPDATE drm.users SET sessions_revoked_at = now() WHERE id = $1 RETURNING sessions_revoked_at",
    [userId],
  );
  const at = rows[0]?.sessions_revoked_at ? new Date(rows[0].sessions_revoked_at).getTime() : Date.now();
  revokedCache.set(String(userId), { revokedAtMs: at, until: Date.now() + CACHE_MS });
}

export function clientIp(req: Request): string {
  const ip = String(req.ip || req.socket?.remoteAddress || "");
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

/** Small user-agent reader (browser, OS, device type) — no extra dependency. */
export function parseUserAgent(ua: string): { browser: string; os: string; device: string } {
  const s = String(ua || "");
  const ver = (re: RegExp) => (re.exec(s)?.[1] || "").split(".")[0];
  let browser = "Unknown";
  if (/Edg\//.test(s)) browser = `Edge ${ver(/Edg\/([\d.]+)/)}`;
  else if (/OPR\/|Opera/.test(s)) browser = `Opera ${ver(/OPR\/([\d.]+)/)}`;
  else if (/SamsungBrowser\//.test(s)) browser = `Samsung Internet ${ver(/SamsungBrowser\/([\d.]+)/)}`;
  else if (/Firefox\//.test(s)) browser = `Firefox ${ver(/Firefox\/([\d.]+)/)}`;
  else if (/Chrome\//.test(s)) browser = `Chrome ${ver(/Chrome\/([\d.]+)/)}`;
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = `Safari ${ver(/Version\/([\d.]+)/)}`;
  else if (s) browser = s.split(" ")[0].slice(0, 40);

  let os = "Unknown";
  if (/Windows NT 10/.test(s)) os = "Windows 10/11";
  else if (/Windows NT/.test(s)) os = "Windows";
  else if (/iPhone|iPad|iPod/.test(s)) os = `iOS ${(/OS (\d+)[_\d]*/.exec(s)?.[1]) || ""}`.trim();
  else if (/Mac OS X/.test(s)) os = "macOS";
  else if (/Android/.test(s)) os = `Android ${ver(/Android ([\d.]+)/)}`.trim();
  else if (/CrOS/.test(s)) os = "ChromeOS";
  else if (/Linux/.test(s)) os = "Linux";

  const device = /iPad|Tablet/.test(s) ? "Tablet" : /Mobi|iPhone|Android/.test(s) ? "Mobile" : "Desktop";
  return { browser: browser.trim(), os, device };
}

export type LoginEvent = "login_success" | "login_failed" | "logout" | "forced_logout";

/** Best effort: a failed audit write never blocks login / logout. */
export async function recordLoginEvent(
  req: Request,
  e: { event: LoginEvent; userId?: string | null; loginId?: string | null; reason?: string | null; actorUserId?: string | null },
): Promise<void> {
  try {
    const ua = String(req.headers["user-agent"] || "").slice(0, 500);
    const { browser, os, device } = parseUserAgent(ua);
    await pool.query(
      `INSERT INTO drm.login_audit (user_id, login_id, event, reason, ip, user_agent, browser, os, device, actor_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [e.userId || null, e.loginId ? String(e.loginId).slice(0, 200) : null, e.event, e.reason || null,
       clientIp(req), ua, browser, os, device, e.actorUserId || null],
    );
  } catch (err) {
    console.warn("[login-audit] write failed:", (err as Error)?.message);
  }
}
