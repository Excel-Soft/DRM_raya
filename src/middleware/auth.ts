import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { unauthorized } from "../utils/errors";

export type AuthUser = {
  id: string;
  role: string;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

type JwtPayload = {
  role?: unknown;
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(unauthorized("Missing Authorization: Bearer <token> header"));
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    return next(unauthorized("Missing token"));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new Error("JWT_SECRET must be set"));
  }

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload & JwtPayload;
    const sub = decoded.sub;
    const role = decoded.role;

    if (typeof sub !== "string" || !sub) {
      return next(unauthorized("Invalid token (missing sub)"));
    }
    if (typeof role !== "string" || !role) {
      return next(unauthorized("Invalid token (missing role)"));
    }

    req.authUser = { id: sub, role };
    return next();
  } catch {
    return next(unauthorized("Invalid or expired token"));
  }
}
