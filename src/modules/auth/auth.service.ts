import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { ApiError, conflict, unauthorized } from "../../utils/errors";

export type PublicUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
};

export type SignupInput = {
  fullName: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

function toPublicUser(row: {
  id: string;
  full_name: string;
  email: string;
  role: string;
}): PublicUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
  };
}

function signToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET must be set");

  return jwt.sign({ role }, secret, {
    subject: userId,
    expiresIn: "12h",
  });
}

export class AuthService {
  async signup(input: SignupInput): Promise<{ user: PublicUser }> {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (existing.length > 0) {
      throw conflict("Email already in use");
    }

    const password_hash = await bcrypt.hash(input.password, 10);

    const [created] = await db
      .insert(users)
      .values({
        full_name: input.fullName,
        email: input.email,
        password_hash,
        role: "Sales Executive",
        is_active: true,
      })
      .returning({
        id: users.id,
        full_name: users.full_name,
        email: users.email,
        role: users.role,
      });

    return { user: toPublicUser(created) };
  }

  async login(input: LoginInput): Promise<{ token: string; user: PublicUser }> {
    const [user] = await db
      .select({
        id: users.id,
        full_name: users.full_name,
        email: users.email,
        role: users.role,
        password_hash: users.password_hash,
        is_active: users.is_active,
      })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user || !user.is_active) {
      throw unauthorized("Invalid credentials");
    }

    const ok = await bcrypt.compare(input.password, user.password_hash);
    if (!ok) {
      throw unauthorized("Invalid credentials");
    }

    const token = signToken(user.id, user.role);
    return { token, user: toPublicUser(user) };
  }

  async me(userId: string): Promise<{ user: PublicUser }> {
    const [user] = await db
      .select({
        id: users.id,
        full_name: users.full_name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new ApiError(404, "USER_NOT_FOUND", "User not found");
    }

    return { user: toPublicUser(user) };
  }
}

export const authService = new AuthService();

