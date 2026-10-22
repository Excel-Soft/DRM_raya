// Central, typed configuration for Copilot. Nothing here is a secret value —
// real secrets stay in the server's secret manager / .env, never a VITE_
// variable, never sent to the client except as booleans via the capability
// endpoint. See backend/copilot.env.example for the full list with comments.
function bool(name: string, def: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return def;
  return raw.toLowerCase() === "true";
}
function int(name: string, def: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : def;
}
function csvSet(name: string): Set<string> {
  const raw = process.env[name] || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export interface CopilotConfig {
  enabled: boolean;
  provider: "anthropic";
  model: string | null;
  apiKey: string | null;
  allowedUserIds: Set<string>;
  allowFollowupCreate: boolean;
  maxToolRounds: number;
  maxOutputTokens: number;
  maxTotalTokensPerTurn: number;
  requestTimeoutMs: number;
  rateLimitPerMinute: number;
  maxActiveTurnsPerConversation: number;
  maxToolResultCharacters: number;
  maxMessageCharacters: number;
  conversationRetentionDays: number;
}

export function loadCopilotConfig(): CopilotConfig {
  return {
    enabled: bool("COPILOT_ENABLED", false),
    provider: "anthropic",
    model: process.env.COPILOT_MODEL?.trim() || null,
    apiKey: process.env.DRM_COPILOT_ANTHROPIC_API_KEY?.trim() || null,
    allowedUserIds: csvSet("COPILOT_ALLOWED_USER_IDS"),
    allowFollowupCreate: bool("COPILOT_ALLOW_FOLLOWUP_CREATE", false),
    maxToolRounds: int("COPILOT_MAX_TOOL_ROUNDS", 6),
    maxOutputTokens: int("COPILOT_MAX_OUTPUT_TOKENS", 1500),
    maxTotalTokensPerTurn: int("COPILOT_MAX_TOTAL_TOKENS_PER_TURN", 20000),
    requestTimeoutMs: int("COPILOT_REQUEST_TIMEOUT_MS", 60000),
    rateLimitPerMinute: int("COPILOT_RATE_LIMIT_PER_MINUTE", 10),
    maxActiveTurnsPerConversation: int("COPILOT_MAX_ACTIVE_TURNS_PER_CONVERSATION", 1),
    maxToolResultCharacters: int("COPILOT_MAX_TOOL_RESULT_CHARACTERS", 12000),
    maxMessageCharacters: int("COPILOT_MAX_MESSAGE_CHARACTERS", 8000),
    conversationRetentionDays: int("COPILOT_CONVERSATION_RETENTION_DAYS", 30),
  };
}

// Known weak/default JWT secrets used only for local/dev — Copilot refuses to
// *activate* (not boot the whole server) if the app is running with one of
// these outside automated tests. Mirrors backend/src/server/config/validate-secrets.ts's
// WEAK_SECRETS check, applied specifically at Copilot's activation boundary.
const KNOWN_WEAK_JWT_SECRETS = new Set([
  "dev-secret-key-change-in-production",
]);

export interface CopilotAvailability {
  configured: boolean;
  reasons: string[];
}

/** Can Copilot run at all in this process, independent of a specific user's allowlist membership? */
export function getCopilotAvailability(cfg: CopilotConfig): CopilotAvailability {
  const reasons: string[] = [];
  if (!cfg.enabled) reasons.push("disabled (COPILOT_ENABLED=false)");
  if (!cfg.model) reasons.push("no COPILOT_MODEL configured");
  if (!cfg.apiKey) reasons.push("no DRM_COPILOT_ANTHROPIC_API_KEY configured");
  if (process.env.MOCK_AUTH === "true" && process.env.NODE_ENV !== "test") {
    reasons.push("refusing to run with MOCK_AUTH=true outside automated tests");
  }
  const jwtSecret = process.env.JWT_SECRET || "";
  if (KNOWN_WEAK_JWT_SECRETS.has(jwtSecret) || jwtSecret.length < 32) {
    reasons.push("refusing to run with a known-weak/default JWT_SECRET");
  }
  return { configured: reasons.length === 0, reasons };
}

export function isUserAllowed(cfg: CopilotConfig, userId: string): boolean {
  // Empty allowlist = nobody can use Copilot (brief §9: "deny-all until an
  // allowlist is configured"), independent of role/label.
  return cfg.allowedUserIds.has(userId);
}
