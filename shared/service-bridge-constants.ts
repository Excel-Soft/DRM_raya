/**
 * Patch 6 Stage 5 — Service-bridge configuration constants.
 *
 * Canonical defaults + validation for the Service -> GM / VAS / BV bridges.
 * Every bridge defaults DISABLED ("false unless management confirmed"): when a
 * bridge is disabled the backend returns 403 "Service bridge is not enabled"
 * and the UI hides the action. Flipping a flag to `true` is an explicit,
 * admin-only, audited config change.
 *
 * Shared (client + server): must NOT import server-only modules.
 */
import { z } from "zod";

/** Effective service-bridge feature flags. All default to `false`. */
export const SERVICE_BRIDGE_CONFIG_DEFAULTS = {
  serviceBridgeGmEnabled: false,
  serviceBridgeVasEnabled: false,
  serviceBridgeBvEnabled: false,
} as const;

export type ServiceBridgeConfig = {
  -readonly [K in keyof typeof SERVICE_BRIDGE_CONFIG_DEFAULTS]: boolean;
};
export type ServiceBridgeConfigKey = keyof ServiceBridgeConfig;

export const SERVICE_BRIDGE_CONFIG_KEYS = Object.keys(
  SERVICE_BRIDGE_CONFIG_DEFAULTS,
) as ServiceBridgeConfigKey[];

export const SERVICE_BRIDGE_CONFIG_KEY_DESCRIPTIONS: Record<
  ServiceBridgeConfigKey,
  string
> = {
  serviceBridgeGmEnabled:
    "Allow the Service module to create/link GM entries via POST /api/service/gm. Default false.",
  serviceBridgeVasEnabled:
    "Allow the Service module to create linked VAS reports via POST /api/service/vas. Default false.",
  serviceBridgeBvEnabled:
    "Allow the Service module to create linked BV reports via POST /api/service/bv. Default false.",
};

/** Partial update validator (admin-only). Strict: rejects unknown keys. */
export const serviceBridgeConfigPatchSchema = z
  .object({
    serviceBridgeGmEnabled: z.boolean().optional(),
    serviceBridgeVasEnabled: z.boolean().optional(),
    serviceBridgeBvEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((o) => Object.keys(o).length > 0, {
    message: "At least one config key must be provided",
  });

/** Canonical service-bridge target modules (also the link-table discriminator). */
export const SERVICE_BRIDGE_TARGETS = {
  GM: "gm",
  VAS: "vas",
  BV: "bv",
} as const;
export type ServiceBridgeTarget =
  (typeof SERVICE_BRIDGE_TARGETS)[keyof typeof SERVICE_BRIDGE_TARGETS];
export const SERVICE_BRIDGE_TARGET_VALUES = Object.values(
  SERVICE_BRIDGE_TARGETS,
) as ServiceBridgeTarget[];

/** Map a target module to the config flag that gates it. */
export const SERVICE_BRIDGE_TARGET_TO_FLAG: Record<
  ServiceBridgeTarget,
  ServiceBridgeConfigKey
> = {
  gm: "serviceBridgeGmEnabled",
  vas: "serviceBridgeVasEnabled",
  bv: "serviceBridgeBvEnabled",
};

/** Shared error message returned when a bridge is disabled. */
export const SERVICE_BRIDGE_DISABLED_MESSAGE = "Service bridge is not enabled";
