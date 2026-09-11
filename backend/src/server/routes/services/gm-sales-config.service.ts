import { GM_SALES_CONFIG_DEFAULTS } from "../../../shared/gm-sales-constants";

export async function getConfig() {
  return { config: GM_SALES_CONFIG_DEFAULTS };
}

export async function getConfigValue(key: keyof typeof GM_SALES_CONFIG_DEFAULTS) {
  return GM_SALES_CONFIG_DEFAULTS[key];
}

export async function patchConfig(updates: Partial<typeof GM_SALES_CONFIG_DEFAULTS>) {
  return { config: { ...GM_SALES_CONFIG_DEFAULTS, ...updates } };
}
