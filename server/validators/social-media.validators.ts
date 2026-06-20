import { z } from "zod";
import { uuid, id, url, isoDate, reason, statusEnum } from "./common.validators";

/**
 * Foundational, reusable validators for the Social Media module (post drafts,
 * scheduling, approve / reject decisions). Building blocks composed from
 * `common.validators`; wire per-route as social-media endpoints are hardened.
 */

export const socialPlatform = statusEnum([
  "facebook",
  "instagram",
  "linkedin",
  "twitter",
  "youtube",
  "tiktok",
  "other",
] as const);

export const socialPostCreateSchema = z.object({
  customerId: uuid.optional(),
  platform: socialPlatform.optional(),
  title: z.string().trim().max(300).optional(),
  content: z.string().trim().max(8000).optional(),
  mediaUrl: url.optional(),
  scheduledAt: isoDate.optional(),
  status: z.string().trim().max(40).optional(),
});

export const socialPostDecisionSchema = z.object({
  entityId: id,
  decision: z.enum(["approve", "reject"]),
  reason: reason.optional(),
});

export type SocialPostCreate = z.infer<typeof socialPostCreateSchema>;
export type SocialPostDecision = z.infer<typeof socialPostDecisionSchema>;
