import type { Request, Response, NextFunction } from "express";

// STUB: real implementation missing from this checkout (broken MVC-restructure commit).
// Pass-through middleware/guard — never blocks a request.
export function requireActionPermission(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function denyPendingManagementDecision(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
