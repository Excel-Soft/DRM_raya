export type ApiErrorBody = {
  success?: boolean;
  error?: { code?: string; message?: string } | string;
  message?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function extractApiErrorMessage(body: unknown, status: number): string {
  if (!body || typeof body !== "object") {
    return `Request failed (${status})`;
  }
  const b = body as ApiErrorBody;
  if (typeof b.error === "object" && b.error?.message) {
    return b.error.message;
  }
  if (typeof b.error === "string") {
    return b.error;
  }
  if (typeof b.message === "string") {
    return b.message;
  }
  return `Request failed (${status})`;
}

export async function throwIfResNotOk(res: Response): Promise<void> {
  if (res.ok) return;

  let body: unknown = null;
  try {
    body = await res.clone().json();
  } catch {
    body = null;
  }

  if (res.status === 403) {
    const extracted = body
      ? extractApiErrorMessage(body, res.status)
      : "You don't have permission to perform this action.";
    const msg =
      extracted !== `Request failed (${res.status})`
        ? extracted
        : "You don't have permission to perform this action.";
    throw new ApiError(msg, 403);
  }

  if (body) {
    throw new ApiError(extractApiErrorMessage(body, res.status), res.status);
  }

  const text = (await res.text().catch(() => "")) || res.statusText;
  throw new ApiError(`${res.status}: ${text}`, res.status);
}

/** Documented 401 behaviour for Phase 2 auth integration (no redirect in scaffold). */
export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function isForbiddenError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
