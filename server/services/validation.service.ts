import { ZodError, type ZodTypeAny, type z } from "zod";
import { ApiError, zodIssues } from "../utils/api-error";

/**
 * ValidationService — a thin, consistent wrapper around Zod parsing that turns
 * validation failures into the project's standard `ApiError` (400
 * VALIDATION_ERROR) so route handlers can `throw` and let `sendError` produce
 * the safe envelope. Never leaks received values — only safe `{path,message}`
 * issues are surfaced.
 *
 * Usage:
 *   const body = ValidationService.parse(createInvoiceSchema, req.body);
 *   // or non-throwing:
 *   const result = ValidationService.safeParse(schema, req.query);
 */
export class ValidationService {
  /**
   * Parse and throw an ApiError(400, VALIDATION_ERROR) on failure.
   */
  static parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
    try {
      return schema.parse(data);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new ApiError(400, "VALIDATION_ERROR", "Invalid request data", zodIssues(err));
      }
      throw err;
    }
  }

  /**
   * Non-throwing parse. Returns a discriminated result so callers can branch
   * without try/catch.
   */
  static safeParse<S extends ZodTypeAny>(
    schema: S,
    data: unknown,
  ):
    | { success: true; data: z.infer<S> }
    | { success: false; error: ApiError } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      error: new ApiError(400, "VALIDATION_ERROR", "Invalid request data", zodIssues(result.error)),
    };
  }

  /** Convenience: validate a request body. */
  static body<S extends ZodTypeAny>(schema: S, req: { body: unknown }): z.infer<S> {
    return this.parse(schema, req.body);
  }

  /** Convenience: validate request query params. */
  static query<S extends ZodTypeAny>(schema: S, req: { query: unknown }): z.infer<S> {
    return this.parse(schema, req.query);
  }

  /** Convenience: validate route params. */
  static params<S extends ZodTypeAny>(schema: S, req: { params: unknown }): z.infer<S> {
    return this.parse(schema, req.params);
  }
}

export default ValidationService;
