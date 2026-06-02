import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details: unknown[];
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[];

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorJson(code: string, message: string, details: unknown[] = []): ErrorResponse {
  return { error: { code, message, details } };
}

function zodDetails(error: ZodError): unknown[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export function notFound(message = "Not found"): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

export function unauthorized(message = "Unauthorized"): ApiError {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Forbidden"): ApiError {
  return new ApiError(403, "FORBIDDEN", message);
}

export function badRequest(message = "Bad request", details: unknown[] = []): ApiError {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function conflict(message = "Conflict", details: unknown[] = []): ApiError {
  return new ApiError(409, "CONFLICT", message, details);
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json(errorJson(err.code, err.message, err.details));
  }

  if (err instanceof ZodError) {
    return res
      .status(400)
      .json(errorJson("VALIDATION_ERROR", "Invalid request data", zodDetails(err)));
  }

  console.error(err);
  return res.status(500).json(errorJson("INTERNAL_ERROR", "Internal server error"));
}

