import type { Request, Response, NextFunction, CookieOptions } from "express";
import { authService, type TokenPayload } from "../services/auth.service.js";
import { normalizeRole } from "../utils/role-utils";

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "auth_token";
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const parseCookieValue = (cookieHeader: string | undefined, cookieName: string): string | undefined => {
  if (!cookieHeader) return undefined;
  const raw = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  if (!raw) return undefined;
  return decodeURIComponent(raw.slice(cookieName.length + 1));
};

const resolveUserId = (payload: TokenPayload | any) =>
  (payload as any).userId ?? (payload as any).id ?? (payload as any).user_id;

const resolveRoleId = (payload: TokenPayload | any) =>
  (payload as any).activeRoleId ??
  (payload as any).roleId ??
  (payload as any).role ??
  (payload as any).role_id;

const resolveCookieOptions = (): CookieOptions => {
  const sameSiteEnv = (process.env.AUTH_COOKIE_SAMESITE ?? "").toLowerCase();
  const isProd = process.env.NODE_ENV === "production";
  const defaultSameSite: CookieOptions["sameSite"] =
    isProd && process.env.FRONTEND_URL ? "none" : "lax";
  const sameSite: CookieOptions["sameSite"] =
    sameSiteEnv === "none" ? "none" : sameSiteEnv === "strict" ? "strict" : defaultSameSite;

  const secure =
    process.env.AUTH_COOKIE_SECURE === "true" ||
    (sameSite === "none" ? true : isProd);

  const maxAgeEnv = Number(process.env.AUTH_COOKIE_MAX_AGE_MS ?? DEFAULT_MAX_AGE_MS);
  const domain = process.env.AUTH_COOKIE_DOMAIN?.trim();

  return {
    httpOnly: true,
    secure,
    sameSite,
    domain: domain || undefined,
    path: "/",
    maxAge: Number.isFinite(maxAgeEnv) ? maxAgeEnv : DEFAULT_MAX_AGE_MS,
  };
};

export const getAuthToken = (req: Request) => {
  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.substring(7).trim()
      : undefined;

  // Disable cookie fallback to ensure strict tab isolation via sessionStorage
  const cookieToken = undefined;

  return {
    token: bearerToken /* ?? cookieToken */,
    bearerToken,
    cookieToken,
    hasAuthHeader: Boolean(authHeader),
    hasBearerToken: Boolean(bearerToken),
    hasAuthCookie: false,
  };
};

export const setAuthCookie = (res: Response, token: string) => {
  const options = resolveCookieOptions();
  res.cookie(AUTH_COOKIE_NAME, token, options);
};

export const clearAuthCookie = (res: Response) => {
  const options = resolveCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, { ...options, maxAge: undefined });
};

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow preflight to pass through without auth enforcement
  if (req.method === "OPTIONS") return next();

  // BYPASS: If req.user is already set (e.g. by MOCK_AUTH in routes.ts), proceed.
  if (req.user) {
    return next();
  }

  const tokenInfo = getAuthToken(req);
  try {
    if (!tokenInfo.token) {
      console.warn(
        `[AUTH] 401 ${req.method} ${req.originalUrl} reason=missing-token header=${tokenInfo.hasAuthHeader ? "y" : "n"} cookie=${tokenInfo.hasAuthCookie ? "y" : "n"} userId=none`,
      );
      return res.status(401).json({ error: "No token provided" });
    }

    const payload = authService.verifyToken(tokenInfo.token);
    const userId = resolveUserId(payload);
    const normalizedRoleId = normalizeRole(resolveRoleId(payload));
    if (!userId) {
      console.warn(
        `[AUTH] 401 ${req.method} ${req.originalUrl} reason=missing-user-id header=${tokenInfo.hasAuthHeader ? "y" : "n"} cookie=${tokenInfo.hasAuthCookie ? "y" : "n"} userId=none`,
      );
      return res.status(401).json({ error: "Invalid token payload" });
    }

    // Attach user info to request
    req.user = {
      ...payload,
      userId,
      roleId: normalizedRoleId,
      roles: (payload as any).roles || [normalizedRoleId],
      activeRoleId: (payload as any).activeRoleId ?? normalizedRoleId,
    };
    // --------------------------------------------------------------
    // 👇 NEW: Ensure per‑executive tables exist and expose the target table name
    // --------------------------------------------------------------
    try {
      const { ensureSalesTables } = await import("../utils/sales-tables.js");
      const salesTable = await ensureSalesTables(userId, normalizedRoleId);
      (req as any).salesTable = salesTable;
    } catch (e) {
      console.warn("[AUTH] Failed to ensure per‑executive sales tables:", e);
      (req as any).salesTable = "sales_executives"; // fallback
    }
    if (process.env.DEBUG_AUTH === "true") {
      console.log(
        `[AUTH_MW] URL=${req.originalUrl} userId=${userId} normalizedRole="${req.user.roleId}" source=${tokenInfo.bearerToken ? "header" : "cookie"}`
      );
    }
    next();
  } catch (error) {
    console.warn(
      `[AUTH] 401 ${req.method} ${req.originalUrl} reason=verify-failed header=${tokenInfo.hasAuthHeader ? "y" : "n"} cookie=${tokenInfo.hasAuthCookie ? "y" : "n"} message=${(error as Error)?.message ?? "unknown"}`,
    );
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}



// Optional: Middleware to check specific roles
//
// Fixed 2026-07-21 (see docs/completion/DECISION_LOG.md D-015): this only
// checked req.user.roleId (the account's static/base role) and req.user.roles
// -- it never checked req.user.activeRoleId (the role the caller is currently
// operating as, e.g. via role-switching). Every other permission check in
// this codebase (resolveGmApprovalScopeUserIds, getActiveRole in
// team-report-link-report-routes.ts, transitionWorkflowStatus's actorRoles,
// etc.) checks activeRoleId first. A caller whose active role was switched to
// one of the allowedRoles, but whose static roleId/roles predates that
// switch, would silently get a 403 here while every other route in the app
// correctly recognized them -- found while investigating why an Account
// Manager approval never reached the backend at all (no audit trace of any
// kind, consistent with a rejection at this exact gate). This only widens
// what already-passing callers were doing (still requires an allowed role,
// just checks the same role signal as everywhere else) -- it cannot grant
// access to anyone who wasn't already going to be treated as that role
// elsewhere in the app.
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const activeRoleId = (req.user as any)?.activeRoleId;
    if (!allowedRoles.some(role => req.user?.roles?.includes(role) || req.user?.roleId === role || activeRoleId === role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}
