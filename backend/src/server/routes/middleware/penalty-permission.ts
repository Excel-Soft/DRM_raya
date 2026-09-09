import type { Request, Response, NextFunction } from "express";

// STUB: real implementation missing from this checkout (broken MVC-restructure commit).
// Pass-through middleware/guard — never blocks a request.
export function getUserId(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function getActiveRole(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function isFullAccess(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function isHr(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function canCreate(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function canDecide(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function canVoid(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function canViewReports(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function getDepartment(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function getAllowedEmployeeIds(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
export function canViewEmployee(...args: any[]) {
  const next = args[args.length - 1];
  if (typeof next === "function") return next();
  return (req: Request, res: Response, nxt: NextFunction) => nxt();
}
