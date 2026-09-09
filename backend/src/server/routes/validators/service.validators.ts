import { z } from "zod";

// STUB: real implementation missing from this checkout (broken MVC-restructure commit).
// Permissive passthrough schemas — accept any object shape.
export const serviceCustomerCreateSchema = z.any();
export const serviceFollowupCreateSchema = z.any();
export const serviceComplaintCreateSchema = z.any();
export const serviceDropoutCreateSchema = z.any();
export const serviceRenewalCreateSchema = z.any();
export const serviceFollowupCompleteSchema = z.any();
export const serviceComplaintResolveSchema = z.any();
export const serviceComplaintCloseSchema = z.any();
export const serviceComplaintUpdateSchema = z.any();
export const serviceDropoutRecoverSchema = z.any();
export const serviceCustomerFeedbackCreateSchema = z.any();
export const serviceSampleRequestCreateSchema = z.any();
