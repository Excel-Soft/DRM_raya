import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authService } from "./auth.service";
import { authMiddleware, setAuthCookie, clearAuthCookie } from "./auth.middleware";
import { pool } from "./db";
import { normalizeRole } from "./utils/role-utils";
import { emailService } from "./email.service";


const router = Router();

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

const resetPasswordSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(6),
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
      return res.status(403).json({
        error: "Public signup is disabled. Please contact an administrator to create an account.",
      });
    }

    const { fullName, email, password } = signupSchema.parse(req.body);

    const existing = await pool.query("select id from drm.users where email = $1 limit 1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
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
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }

    console.error("Signup error:", error);
    return res.status(500).json({ error: "Internal server error" });
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
      return res.status(401).json({ error: "Invalid credentials" });
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
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await authService.comparePassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const payload = await issueAuthPayload(user);
    setAuthCookie(res, payload.token);
    return res.json(payload);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }

    // Log full details server-side only; never leak stack/SQL/internals to the client.
    console.error("Login error DETAILS:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user endpoint
router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // If impersonating, fetch the identity of the impersonator (the admin) so their name shows in the UI
    const fetchId = (req.user as any).impersonatorId || req.user.userId;

    const result = await pool.query(
      "select id, full_name, email, role, roles, is_active from drm.users where id = $1 limit 1",
      [fetchId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
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
    return res.status(500).json({ error: "Internal server error" });
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
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const result = await pool.query(
      "select id, full_name, email, role, is_active from drm.users where id = $1 limit 1",
      [req.user.userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = result.rows[0] as {
      id: string;
      full_name: string;
      email: string;
      role: string;
      is_active: boolean;
    };
    if (!user.is_active) {
      return res.status(401).json({ error: "User inactive" });
    }
    const payload = await issueAuthPayload(user);
    setAuthCookie(res, payload.token);
    return res.json(payload);
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Active role handling: accepts roleId and re-issues token
// This endpoint allows ANY user (not just admins) to switch between their assigned roles
router.post("/set-active-role", authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Not authenticated" });
    const roleId = normalizeRole((req.body?.roleId as string) || "");
    if (!roleId) return res.status(400).json({ error: "roleId is required" });

    const result = await pool.query(
      "select id, full_name, email, role, roles, is_active from drm.users where id = $1 limit 1",
      [req.user.userId],
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const user = result.rows[0] as { id: string; full_name: string; email: string; role: string; roles: string[]; is_active: boolean };
    if (!user.is_active) return res.status(401).json({ error: "User inactive" });

    // Build list of allowed roles from the user's roles array
    const normalizedRole = normalizeRole(user.role);
    const userRoles: string[] = user.roles && Array.isArray(user.roles) && user.roles.length > 0
      ? user.roles.map((r: string) => normalizeRole(r))
      : [normalizedRole];

    // Allow switching to any role in the user's assigned roles array
    const allowed = userRoles.includes(roleId);
    console.log(`[SET-ACTIVE-ROLE] User: ${user.email}, requested: "${roleId}", allowed roles: [${userRoles.join(', ')}], allowed: ${allowed}`);

    if (!allowed) {
      return res.status(403).json({ error: "Forbidden", message: `Role "${roleId}" is not assigned to this user` });
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
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Reset password by email (no email delivery; direct reset)
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = resetPasswordSchema.parse(req.body);

    const result = await pool.query(
      "select id, is_active from drm.users where email = $1 limit 1",
      [email],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const user = result.rows[0] as { id: string; is_active: boolean };
    if (!user.is_active) {
      return res.status(400).json({ error: "User is inactive" });
    }

    const passwordHash = await authService.hashPassword(newPassword);
    await pool.query(
      "update drm.users set password_hash = $1, updated_at = now() where id = $2",
      [passwordHash, user.id],
    );

    return res.json({ success: true, message: "Password reset successful" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// Forgot Password: Generate reset link (displayed in console, no email delivery)
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    // Check if user exists
    const userRes = await pool.query("select id, is_active from drm.users where email = $1 limit 1", [email]);

    if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
      // Don't reveal if user exists or not for security
      return res.json({ success: true, message: "If the email exists, check the server console for the reset link." });
    }

    // Generate random reset token
    const resetToken = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36);

    // Invalidate old tokens
    await pool.query("update drm.password_reset_tokens set used = true where email = $1", [email]);

    // Store new token (valid for 15 minutes)
    await pool.query(
      "insert into drm.password_reset_tokens (email, token, expires_at) values ($1, $2, now() + interval '15 minutes')",
      [email, resetToken]
    );

    // Generate reset link - points to auth page
    const resetLink = `http://localhost:5000/auth?mode=reset&email=${encodeURIComponent(email)}&token=${resetToken}`;

    // Display in console for user to access
    console.log("\n" + "=".repeat(80));
    console.log("PASSWORD RESET LINK GENERATED");
    console.log("=".repeat(80));
    console.log(`Email: ${email}`);
    console.log(`Reset Link: ${resetLink}`);
    console.log(`Token (copy this): ${resetToken}`);
    console.log(`Valid for: 15 minutes`);
    console.log("=".repeat(80) + "\n");

    return res.json({ success: true, message: "Check the server console for the password reset link." });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid data", details: error.errors });
    }

    console.error("Forgot password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// Reset Password with Token
router.post("/reset-password-with-token", async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = z.object({
      email: z.string().email(),
      token: z.string().min(1),
      newPassword: z.string().min(6)
    }).parse(req.body);

    // Verify token
    const tokenRes = await pool.query(
      "select * from drm.password_reset_tokens where email = $1 and token = $2 and used = false and expires_at > now() order by created_at desc limit 1",
      [email, token]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const record = tokenRes.rows[0];

    // Mark token used
    await pool.query("update drm.password_reset_tokens set used = true where id = $1", [record.id]);

    // Update User Password
    const passwordHash = await authService.hashPassword(newPassword);

    // Update both password_hash (for security) and password (plaintext, as per existing deprecated pattern maintained for compatibility)
    await pool.query(
      "update drm.users set password_hash = $1, password = $2, updated_at = now() where email = $3",
      [passwordHash, newPassword, email]
    );

    console.log(`[AUTH] Password reset successful for: ${email}`);

    return res.json({ success: true, message: "Password reset successful" });

  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
    console.error("Reset password token error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

