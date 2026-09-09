/**
 * Production secret validation (PATCH 6 Stage 1, deliverable B).
 *
 * Refuses to start a PRODUCTION server with a missing / weak / placeholder JWT
 * signing secret (and validates SESSION_SECRET when present, and MOCK_AUTH).
 * In non-production it only warns, so local dev keeps working with the in-repo
 * development fallback.
 *
 * SECURITY: this module NEVER logs secret VALUES — only the variable name and
 * the reason it failed.
 */

/** Minimum acceptable length for a signing secret. */
export const MIN_SECRET_LENGTH = 32;

/**
 * Known weak / placeholder secrets that must never reach production. Compared
 * case-insensitively. Includes the in-repo development fallback so a deploy that
 * forgets to set JWT_SECRET cannot silently ship with it.
 */
const WEAK_SECRETS = new Set<string>([
  "secret",
  "jwt_secret",
  "jwtsecret",
  "dev_secret",
  "dev-secret",
  "dev-secret-key-change-in-production",
  "changeme",
  "change-me",
  "change_me",
  "test",
  "testing",
  "password",
  "passw0rd",
  "123456",
  "default",
  "your-secret-key",
  "your_secret_key",
]);

export interface SecretValidationResult {
  ok: boolean;
  isProduction: boolean;
  errors: string[];
  warnings: string[];
}

function isWeak(value: string): boolean {
  return WEAK_SECRETS.has(value.trim().toLowerCase());
}

/**
 * Validate the security-critical secrets. Pure (no process exit, no value
 * logging) so it is unit-testable. `assertSecretsOrExit` wraps it for startup.
 */
export function validateSecrets(
  env: NodeJS.ProcessEnv = process.env,
): SecretValidationResult {
  const isProduction = env.NODE_ENV === "production";
  const errors: string[] = [];
  const warnings: string[] = [];

  const jwt = env.JWT_SECRET?.trim() ?? "";
  if (!jwt) {
    (isProduction ? errors : warnings).push(
      "JWT_SECRET is not set." +
        (isProduction
          ? " A strong JWT_SECRET is REQUIRED in production."
          : " Using the development fallback (NOT for production)."),
    );
  } else {
    if (isWeak(jwt)) {
      (isProduction ? errors : warnings).push(
        "JWT_SECRET is a known weak/placeholder value; set a unique high-entropy secret.",
      );
    }
    if (jwt.length < MIN_SECRET_LENGTH) {
      (isProduction ? errors : warnings).push(
        `JWT_SECRET is too short (< ${MIN_SECRET_LENGTH} chars); use a longer high-entropy secret.`,
      );
    }
  }

  // SESSION_SECRET is optional; validate only when it is actually set.
  const session = env.SESSION_SECRET?.trim();
  if (session !== undefined && session !== "") {
    if (isWeak(session)) {
      (isProduction ? errors : warnings).push(
        "SESSION_SECRET is a known weak/placeholder value; set a unique high-entropy secret.",
      );
    }
    if (session.length < MIN_SECRET_LENGTH) {
      (isProduction ? errors : warnings).push(
        `SESSION_SECRET is too short (< ${MIN_SECRET_LENGTH} chars); use a longer high-entropy secret.`,
      );
    }
  }

  // MOCK_AUTH bypasses authentication entirely — must never be on in production.
  if (isProduction && env.MOCK_AUTH === "true") {
    errors.push(
      "MOCK_AUTH=true disables authentication and must NOT be enabled in production.",
    );
  }

  return { ok: errors.length === 0, isProduction, errors, warnings };
}

/**
 * Startup guard: validate secrets and, in production, exit(1) on any error
 * BEFORE the server binds a port or signs any token. In non-production it logs
 * warnings and continues. Never prints secret values.
 */
export function assertSecretsOrExit(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const result = validateSecrets(env);

  for (const w of result.warnings) {
    console.warn(`[secrets] WARNING: ${w}`);
  }

  if (!result.ok) {
    for (const e of result.errors) {
      console.error(`[secrets] ERROR: ${e}`);
    }
    if (result.isProduction) {
      console.error(
        "[secrets] Refusing to start in production with an invalid secret configuration. " +
          "See DEPLOYMENT_SECRETS_RUNBOOK.md.",
      );
      process.exit(1);
    } else {
      console.warn(
        "[secrets] Continuing despite secret issues (non-production only). " +
          "These WILL block a production deploy.",
      );
    }
  }
}
