import "./utils/env";
import jwt from "jsonwebtoken";
import { createHash } from "node:crypto";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

export type TokenPayload = {
  userId: string;
  email: string;
  roleId: string;
  roles: string[];
  activeRoleId?: string;
  branch: string;
  country: string;
  impersonatorId?: string; // ID of the admin impersonating this user/role
  type?: "impersonation" | "auth";
};

export class AuthService {
  generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  async hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, 10);
  }

  async comparePassword(plainPassword: string, passwordHash: string): Promise<boolean> {
    if (!passwordHash) return false;

    if (passwordHash.startsWith("sha256:")) {
      const expected = passwordHash.slice("sha256:".length);
      const actual = createHash("sha256").update(plainPassword).digest("hex");
      return actual === expected;
    }

    return bcrypt.compare(plainPassword, passwordHash);
  }
}

export const authService = new AuthService();
