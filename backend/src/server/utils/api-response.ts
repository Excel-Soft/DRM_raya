/**
 * Patch 5 — standard API response envelope helpers.
 *
 * Use these for NEW / Patch-5-modified endpoints only. Error responses never
 * include stack traces, SQL text, secrets or raw DB messages — callers must pass
 * a safe, human-readable `message` and optional structured `details`.
 */
import type { Response } from "express";
import { ZodError } from "zod";

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

export function errorEnvelope(
  code: string,
  message: string,
  details?: unknown,
): ApiErrorBody {
  return {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

export function successEnvelope<T>(data: T): ApiSuccessBody<T> {
  return { success: true, data };
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return res.status(status).json(errorEnvelope(code, message, details));
}

export function sendSuccess<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json(successEnvelope(data));
}

/** Flatten a ZodError into a safe details array (no raw input echoed back). */
export function zodIssues(err: ZodError): Array<{ path: string; message: string; code: string }> {
  return err.issues.map((i) => ({
    path: i.path.join("."),
    message: i.message,
    code: i.code,
  }));
}
