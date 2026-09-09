import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Lightweight request-ID middleware (Stage 10, task F).
 *
 * - Reuses an inbound `X-Request-Id` if a trusted upstream proxy already set one
 *   (sanitized + length-capped), otherwise generates a fresh UUID.
 * - Exposes the id on `req.id` for downstream handlers/loggers.
 * - Echoes the id back to the client via the `X-Request-Id` response header so a
 *   user-reported error can be correlated with server logs.
 *
 * It deliberately does NOT log request/response bodies, headers, query strings
 * or any credentials — only the id itself is propagated.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

const HEADER = "X-Request-Id";
// Allow only safe id characters and cap the length to avoid log/ header abuse.
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const inbound = req.header(HEADER);
  const id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  req.id = id;
  res.setHeader(HEADER, id);
  next();
}
