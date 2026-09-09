import type { Response } from "express";
import { ZodError } from "zod";

/**
 * Standard error envelope used across the active backend.
 *
 * Shape:
 *   {
 *     success: false,
 *     error: { code, message, details? },
 *     message            // top-level mirror kept for FE backward-compat (toasts)
 *   }
 *
 * NEVER include stack traces, raw SQL, driver internals or secrets in `details`.
 */

export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | string;

export interface ErrorEnvelope {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// --- Factories ---------------------------------------------------------------

export function badRequest(message = "Bad request", details?: unknown): ApiError {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Not authenticated", details?: unknown): ApiError {
  return new ApiError(401, "UNAUTHORIZED", message, details);
}

export function forbidden(message = "Forbidden", details?: unknown): ApiError {
  return new ApiError(403, "FORBIDDEN", message, details);
}

export function notFound(message = "Not found", details?: unknown): ApiError {
  return new ApiError(404, "NOT_FOUND", message, details);
}

export function conflict(message = "Conflict", details?: unknown): ApiError {
  return new ApiError(409, "CONFLICT", message, details);
}

export function internal(message = "Internal server error", details?: unknown): ApiError {
  return new ApiError(500, "INTERNAL_ERROR", message, details);
}

// --- Envelope builder --------------------------------------------------------

/**
 * Build the standard error envelope. The top-level `message` mirrors
 * `error.message` so existing frontend toast handlers keep working.
 */
export function errorEnvelope(code: ErrorCode, message: string, details?: unknown): ErrorEnvelope {
  const envelope: ErrorEnvelope = {
    success: false,
    error: { code, message },
    message,
  };
  if (details !== undefined) {
    envelope.error.details = details;
  }
  return envelope;
}

/**
 * Reduce a ZodError to a safe issue list (path + message only). Never leaks
 * received values or internal schema metadata.
 */
export function zodIssues(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

/**
 * Map any thrown error to the standard envelope and send it.
 *  - ApiError       -> its own status/code/details
 *  - ZodError       -> 400 VALIDATION_ERROR with safe issue list
 *  - anything else  -> 500 INTERNAL_ERROR with a generic message
 */
export function sendError(res: Response, err: unknown): Response {
  if (err instanceof ApiError) {
    return res.status(err.status).json(errorEnvelope(err.code, err.message, err.details));
  }

  if (err instanceof ZodError) {
    return res
      .status(400)
      .json(errorEnvelope("VALIDATION_ERROR", "Invalid request data", zodIssues(err)));
  }

  // Never leak stack/SQL/driver internals to the client.
  return res.status(500).json(errorEnvelope("INTERNAL_ERROR", "Internal server error"));
}

/**
 * Send a safe, client-facing error with an explicit status/code/message.
 * Use when you want full control over the response without throwing. The body
 * is always the standard envelope — it can never carry a stack, SQL or secret
 * because only the provided `message` string is emitted.
 */
export function sendSafeError(
  res: Response,
  status: number,
  code: ErrorCode,
  message: string,
): Response {
  return res.status(status).json(errorEnvelope(code, message));
}

/**
 * Object-form helper for the standard error envelope:
 *
 *   sendApiError(res, { status, code, message, details });
 *
 * Emits exactly `{ success:false, error:{ code, message, details? }, message }`.
 * `details` must already be safe (no stack traces, SQL, driver internals or
 * secrets) — only the fields you pass are serialized.
 */
export function sendApiError(
  res: Response,
  opts: { status: number; code: ErrorCode; message: string; details?: unknown },
): Response {
  return res.status(opts.status).json(errorEnvelope(opts.code, opts.message, opts.details));
}
