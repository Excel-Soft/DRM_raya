import type { ZodType } from "zod";

/**
 * Thin wrapper around Zod parse — keeps route handlers consistent and testable.
 */
export const ValidationService = {
  parse<T>(schema: ZodType<T>, data: unknown): T {
    return schema.parse(data);
  },
};
