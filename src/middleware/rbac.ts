import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../utils/errors";

export function requireRole(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.authUser;
    if (!user) return next(unauthorized());

    if (!allowedRoles.includes(user.role)) {
      return next(forbidden("Insufficient permissions"));
    }

    return next();
  };
}
