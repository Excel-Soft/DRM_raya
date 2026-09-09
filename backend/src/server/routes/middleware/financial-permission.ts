import type { Request, Response, NextFunction } from "express";

// STUB: real implementation missing from this checkout (broken MVC-restructure commit).
// Pass-through middleware/guard — never blocks a request.
export function requireFinancialPermission(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function FINANCIAL_ACTIONS(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function FINANCIAL_VIEW_ROLES(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function FINANCIAL_WRITE_ROLES(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function FINANCIAL_VOID_ROLES(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function STAGE2_FINANCIAL_ROLES(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
