import type { Request, Response, NextFunction } from "express";

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const level = (process.env.LOG_LEVEL || "short").toLowerCase();
  if (level === "off") return next();

  const path = req.originalUrl || req.url;
  const shouldLog =
    path.startsWith("/api/crm") ||
    path.startsWith("/api/manager") ||
    path.startsWith("/api/hod") ||
    path.startsWith("/api/pms") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api");

  if (!shouldLog) return next();

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    // Request id (set by requestIdMiddleware) is included for log correlation.
    // No request/response bodies or auth headers are ever logged.
    const rid = req.id ? ` rid=${req.id}` : "";
    if (level === "short") {
      console.log(
        `[${new Date().toISOString()}]${rid} ${req.method} ${path} -> ${res.statusCode} (${duration}ms)`,
      );
    } else {
      console.log(
        `[${new Date().toISOString()}]${rid} ${req.method} ${path} -> ${res.statusCode} (${duration}ms) query=${JSON.stringify(
          req.query,
        )}`,
      );
    }
  });

  next();
}
