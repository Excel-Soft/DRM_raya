import { z } from "zod";

// STUB: real implementation missing from this checkout (broken MVC-restructure commit).
// Permissive passthrough schemas — accept any object shape.
export const penaltyCreateSchema = z.any();
export const penaltyUpdateSchema = z.any();
export const penaltyDecisionSchema = z.any();
export const penaltyVoidSchema = z.any();
