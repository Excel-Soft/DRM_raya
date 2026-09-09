import { Router, type Request, type Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { authService } from "../services/auth.service";
import { authMiddleware, setAuthCookie, clearAuthCookie } from "../middleware/auth.middleware";
import { pool } from "../db";
import { normalizeRole } from "../utils/role-utils";
import { emailService } from "../services/email.service";
import { sendError, badRequest, unauthorized, forbidden, notFound, conflict } from "../utils/api-error";


const router = Router();

// Hash a reset token before it touches the database. Raw tokens are never stored.
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

// Lightweight in-memory rate limiter for the forgot-password endpoint (no extra
// dependency). Keyed by IP + email; sliding window. Process-local only, which is
// sufficient to blunt brute-force/enumeration on a single-instance deployment.
const forgotPasswordHits = new Map<string, number[]>();
const FORGOT_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_MAX_PER_WINDOW = 5;
function forgotPasswordRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (forgotPasswordHits.get(key) || []).filter((t) => now - t < FORGOT_WINDOW_MS);
  recent.push(now);
  forgotPasswordHits.set(key, recent);
  return recent.length > FORGOT_MAX_PER_WINDOW;
}

// Login endpoint
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
});

// Utility to issue token + normalized user payload
async function issueAuthPayload(user: {
  id: string;
  full_name: string;
  email: string;
  role: string;
  roles?: string[];
}) {
  const normalizedRole = normalizeRole(user.role);
  const activeRoleId = normalizedRole;
  const userRoles = user.roles && user.roles.length > 0 ? user.roles : [normalizedRole];
  const token = authService.generateToken({
    userId: user.id,
    email: user.email,
    roleId: normalizedRole,
    roles: userRoles,
    activeRoleId,
    branch: "",
    country: "",
  });
  return {
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: normalizedRole,
      roles: userRoles,
      activeRoleId,
    },
  };
}

// Safe, lowest-privilege role assigned to self-service signups. NEVER "admin".
// The existing role model has no "pending_user"/"employee" role, so we use the
// least-privileged real role; an administrator can elevate it afterwards.
const SIGNUP_DEFAULT_ROLE = "sales_executive";

router.post("/signup", async (req: Request, res: Response) => {
  try {
    // Public self-service signup is disabled in production. Accounts must be
    // created/approved by an administrator.
    if (process.env.NODE_ENV === "production") {
      return sendError(res, forbidden("Public signup is disabled. Please contact an administrator to create an account."));
    }

    const { fullName, email, password } = signupSchema.parse(req.body);

    const existing = await pool.query("select id from drm.users where email = $1 limit 1", [email]);
    if (existing.rows.length > 0) {
      return sendError(res, conflict("Email already in use"));
    }

    const passwordHash = await authService.hashPassword(password);

    const created = await pool.query(
      "insert into drm.users (full_name, email, password_hash, role, is_active, created_at, updated_at) values ($1, $2, $3, $4, true, now(), now()) returning id, full_name, email, role",
      [fullName, email, passwordHash, SIGNUP_DEFAULT_ROLE],
    );

    const user = created.rows[0] as {
      id: string;
      full_name: string;
      email: string;
      role: string;
    };

    const payload = await issueAuthPayload(user);
    return res.status(201).json({ user: payload.user });
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      console.error("Signup error:", error);
    }
    return sendError(res, error);
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await pool.query(
      "select id, full_name, email, password_hash, role, roles, is_active from drm.users where email = $1 limit 1",
      [email],
    );
    if (result.rows.length === 0) {
      return sendError(res, unauthorized("Invalid credentials"));
    }

    const user = result.rows[0] as {
      id: string;
      full_name: string;
      email: string;
      password_hash: string;
      role: string;
      roles: string[];
      is_active: boolean;
    };

    if (!user.is_active) {
      return sendError(res, unauthorized("Invalid credentials"));
    }

    const ok = await authService.comparePassword(password, user.password_hash);
    if (!ok) {
      return sendError(res, unauthorized("Invalid credentials"));
    }

    const payload = await issueAuthPayload(user);
    setAuthCookie(res, payload.token);
    return res.json(payload);
  } catch (error: any) {
    if (!(error instanceof z.ZodError)) {
      // Log full details server-side only; never leak stack/SQL/internals to the client.
      console.error("Login error DETAILS:", error);
    }
    return sendError(res, error);
  }
});

// Get current user endpoint
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, unauthorized("Not authenticated"));
    }

    // If impersonating, fetch the identity of the impersonator (the admin) so their name shows in the UI
    const fetchId = (req.user as any).impersonatorId || req.user.userId;

    const result = await pool.query(
      "select id, full_name, email, role, roles, is_active from drm.users where id = $1 limit 1",
      [fetchId],
    );
    if (result.rows.length === 0) {
      return sendError(res, notFound("User not found"));
    }

    const user = result.rows[0] as {
      id: string;
      full_name: string;
      email: string;
      role: string;
      roles: string[];
      is_active: boolean;
    };

    // When impersonating, return the active role, not the original role
    const activeRole = (req.user as any)?.activeRoleId ?? normalizeRole(user.role);

    return res.json({
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: activeRole,  // Return the active role (impersonated or original)
      roles: user.roles || [normalizeRole(user.role)],
      activeRoleId: activeRole,
      isActive: user.is_active,
      isImpersonating: !!(req.user as any)?.impersonatorId,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return sendError(res, error);
  }
});

// Logout (stateless JWT): client should drop the token
router.post("/logout", authMiddleware, async (_req: Request, res: Response) => {
  clearAuthCookie(res);
  return res.json({ success: true });
});

// Refresh: re-read user from DB, normalize role, and issue fresh token
router.post("/refresh", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) return sendError(res, unauthorized("Not authenticated"));
    const result = await pool.query(
      "select id, full_name, email, role, is_active from drm.users where id = $1 limit 1",
      [req.user.userId],
    );
    if (result.rows.length === 0) {
      return sendError(res, notFound("User not found"));
    }
    const user = result.rows[0] as {
      id: string;
      full_name: string;
      email: string;
      role: string;
      is_active: boolean;
    };
    if (!user.is_active) {
      return sendError(res, unauthorized("User inactive"));
    }
    const payload = await issueAuthPayload(user);
    setAuthCookie(res, payload.token);
    return res.json(payload);
  } catch (error) {
    console.error("Refresh token error:", error);
    return sendError(res, error);
  }
});

// Active role handling: accepts roleId and re-issues token
// This endpoint allows ANY user (not just admins) to switch between their assigned roles
router.post("/set-active-role", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) return sendError(res, unauthorized("Not authenticated"));
    const roleId = normalizeRole((req.body?.roleId as string) || "");
    if (!roleId) return sendError(res, badRequest("roleId is required"));

    const result = await pool.query(
      "select id, full_name, email, role, roles, is_active from drm.users where id = $1 limit 1",
      [req.user.userId],
    );
    if (result.rows.length === 0) return sendError(res, notFound("User not found"));
    const user = result.rows[0] as { id: string; full_name: string; email: string; role: string; roles: string[]; is_active: boolean };
    if (!user.is_active) return sendError(res, unauthorized("User inactive"));

    // Build list of allowed roles from the user's roles array
    const normalizedRole = normalizeRole(user.role);
    const userRoles: string[] = user.roles && Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles.map((r: string) => normalizeRole(r))
      : [normalizedRole];

    // Allow switching to any role in the user's assigned roles array
    const allowed = userRoles.includes(roleId);
    if (process.env.DEBUG_AUTH === "true") {
      console.log(`[SET-ACTIVE-ROLE] User: ${user.email}, requested: "${roleId}", allowed roles: [${userRoles.join(', ')}], allowed: ${allowed}`);
    }

    if (!allowed) {
      return sendError(res, forbidden(`Role "${roleId}" is not assigned to this user`));
    }

    const token = authService.generateToken({
      userId: user.id,
      email: user.email,
      roleId: roleId, // Use the requested role as primary
      roles: userRoles,
      activeRoleId: roleId,
      branch: "",
      country: "",
    });
    setAuthCookie(res, token);
    return res.json({
      success: true,
      token,
      actingRole: roleId,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: roleId,
        roles: userRoles,
        activeRoleId: roleId,
      },
    });
  } catch (error) {
    console.error("Set active role error:", error);
    return sendError(res, error);
  }
});

// Forgot Password: issue a single-use, expiring reset token.
// Security: cryptographically-random token; only its SHA-256 HASH is stored;
// generic response (no account enumeration); rate-limited; the raw token/link is
// surfaced only in non-production (no email delivery is wired) and never logged
// in production.
router.post("/forgot-password", async (req: Request, res: Response) => {
  const GENERIC_MESSAGE = "If the email exists, a password reset link has been generated.";
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    const rlKey = `${req.ip || "unknown"}:${email.toLowerCase()}`;
    if (forgotPasswordRateLimited(rlKey)) {
      // Same generic response so callers cannot distinguish rate-limit from success.
      return res.json({ success: true, message: GENERIC_MESSAGE });
    }

    const userRes = await pool.query("select id, is_active from drm.users where email = $1 limit 1", [email]);

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      // Do not reveal whether the account exists.
      return res.json({ success: true, message: GENERIC_MESSAGE });
    }

    // Cryptographically-strong, single-use token. Persist only the hash.
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);

    // Invalidate any outstanding tokens for this email, then store the new hash.
    await pool.query("update drm.password_reset_tokens set used = true where email = $1", [email]);
    await pool.query(
      "insert into drm.password_reset_tokens (email, token, expires_at) values ($1, $2, now() + interval '15 minutes')",
      [email, tokenHash]
    );

    // Dev convenience only: print the raw link/token to the console. Never in prod.
    if (process.env.NODE_ENV !== "production") {
      const baseUrl = process.env.FRONTEND_URL?.trim() || `${req.protocol}://${req.get("host")}`;
      const resetLink = `${baseUrl}/auth?mode=reset&email=${encodeURIComponent(email)}&token=${rawToken}`;
      console.log("\n" + "=".repeat(80));
      console.log("PASSWORD RESET LINK (development only)");
      console.log("=".repeat(80));
      console.log(`Email: ${email}`);
      console.log(`Reset Link: ${resetLink}`);
      console.log(`Token: ${rawToken}`);
      console.log(`Valid for: 15 minutes`);
      console.log("=".repeat(80) + "\n");
    }

    return res.json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      console.error("Forgot password error:", error);
    }
    return sendError(res, error);
  }
});


// Reset Password with Token: validates the hashed, unexpired, unused token,
// consumes it (one-time use) and writes ONLY the bcrypt password hash.
router.post("/reset-password-with-token", async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = z.object({
      email: z.string().email(),
      token: z.string().min(1),
      newPassword: z.string().min(6)
    }).parse(req.body);

    // Compare against the stored hash; raw tokens are never persisted.
    const tokenHash = hashToken(token);
    const tokenRes = await pool.query(
      "select id from drm.password_reset_tokens where email = $1 and token = $2 and used = false and expires_at > now() order by created_at desc limit 1",
      [email, tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      return sendError(res, badRequest("Invalid or expired reset token"));
    }

    const record = tokenRes.rows[0];

    // One-time use: consume the token immediately.
    await pool.query("update drm.password_reset_tokens set used = true where id = $1", [record.id]);

    // Store ONLY the bcrypt hash. The legacy plaintext column is no longer written.
    const passwordHash = await authService.hashPassword(newPassword);
    await pool.query(
      "update drm.users set password_hash = $1, updated_at = now() where email = $2",
      [passwordHash, email]
    );

    if (process.env.DEBUG_AUTH === "true") {
      console.log(`[AUTH] Password reset successful for: ${email}`);
    }

    return res.json({ success: true, message: "Password reset successful" });

  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      console.error("Reset password token error:", error);
    }
    return sendError(res, error);
  }
});

export default router;

