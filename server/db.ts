import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import "./env"; // loads env before reading values

const { Pool } = pg;

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function validateDbHost(host: string): void {
  const looksLocal = host === "localhost" || host === "127.0.0.1";
  const hasDomain = host.includes(".");
  // Render internal Postgres hosts (internal service name without dot), e.g. dpg-xxxxxx-a
  const looksRenderInternal = /^dpg-[a-z0-9]+/i.test(host);
  // Replit internal Postgres proxy uses a single-label host (e.g. "helium")
  const looksReplitInternal = host === "helium" || host === process.env.PGHOST;

  if (!host || (!looksLocal && !hasDomain && !looksRenderInternal && !looksReplitInternal)) {
    throw new Error(
      `Invalid DB host "${host}". Set DATABASE_URL (or DB_HOST) with the full hostname, e.g. *.render.com`,
    );
  }
}

function getConnectionConfig() {
  const urlFromEnv = process.env.DATABASE_URL;
  const hasParts =
    process.env.DB_HOST ||
    process.env.DB_PORT ||
    process.env.DB_NAME ||
    process.env.DB_USER ||
    process.env.DB_PASSWORD;

  if (!urlFromEnv && !hasParts) {
    throw new Error("DATABASE_URL (or DB_HOST/DB_NAME/DB_USER/DB_PASSWORD) must be set.");
  }

  if (urlFromEnv) {
    let parsed: URL;
    try {
      parsed = new URL(urlFromEnv);
    } catch (err: any) {
      throw new Error(`Invalid DATABASE_URL: ${err?.message || String(err)}`);
    }
    const host = parsed.hostname;
    // Use port from URL or fallback
    const port = parsed.port || "5432";
    const database = parsed.pathname.replace(/^\//, "");
    const user = safeDecode(parsed.username || "");
    const password = safeDecode(parsed.password || "");
    validateDbHost(host);
    
    // Reconstruct connection string with correct search_path
    const searchParams = new URLSearchParams(parsed.search);
    if (!searchParams.has("options")) {
      searchParams.set("options", "-c search_path=drm,public");
    }
    const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?${searchParams.toString()}`;
    
    return {
      connectionString,
      host,
      port,
      database,
      user,
      password,
      sslFromUrl: parsed.searchParams.get("sslmode"),
    };
  }

  const host = process.env.DB_HOST || "";
  const port = process.env.DB_PORT || "5432";
  const database = process.env.DB_NAME || "";
  const user = process.env.DB_USER || "";
  const password = process.env.DB_PASSWORD || "";
  validateDbHost(host);
  const connectionString = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
    password,
  )}@${host}:${port}/${database}?options=-c%20search_path=drm,public`;
  return {
    connectionString,
    host,
    port,
    database,
    user,
    password,
    sslFromUrl: undefined,
  };
}

const conn = getConnectionConfig();

let dbAvailable = true;
let dbUnavailableReason: string | null = null;
let lastHealthCheckAt = 0;
let dbRecoveryProbe: Promise<boolean> | null = null;

export function markDbUnavailable(reason: string, err?: unknown) {
  dbAvailable = false;
  dbUnavailableReason = reason;
  console.error(`[db] marked unavailable: ${reason}`, err ?? "");
}

export function isDbAvailable(): boolean {
  return dbAvailable;
}

export function getDbUnavailableReason(): string | null {
  return dbUnavailableReason;
}

export async function ensureDbAvailable(force = false): Promise<boolean> {
  if (dbAvailable && !force) {
    return true;
  }

  const now = Date.now();
  if (!force && dbRecoveryProbe) {
    return dbRecoveryProbe;
  }

  // Avoid hammering the database when multiple requests land during a brief outage.
  if (!force && now - lastHealthCheckAt < 1500) {
    return dbAvailable;
  }

  lastHealthCheckAt = now;
  dbRecoveryProbe = (async () => {
    const health = await checkDbHealth();
    return health.ok;
  })();

  try {
    return await dbRecoveryProbe;
  } finally {
    dbRecoveryProbe = null;
  }
}

export function isNetworkOrDnsError(err: any): boolean {
  const code = (err as any)?.code;
  // Note: ETIMEDOUT is NOT included here — a timeout at startup doesn't mean DB is
  // permanently unavailable; it may succeed on the next request.
  return code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ECONNREFUSED";
}

// One-time safe startup log (no password)
if (!process.env.DB_LOGGED) {
  console.info(
    `[db] connecting host=${conn.host} port=${conn.port} db=${conn.database} user=${conn.user || "unknown"} ssl=${(process.env.DB_SSL ?? process.env.DATABASE_SSL) === "true" ||
      (conn.sslFromUrl && conn.sslFromUrl !== "disable")
      ? "on"
      : "off"
    }`,
  );
  process.env.DB_LOGGED = "true";
}

// For Render internal Postgres SSL is usually off; keep ssl optional
export const pool = new Pool({
  connectionString: conn.connectionString,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 5000,   // Release idle connections quickly
  max: 4,                    // Supabase session mode limit is 15; keep low to allow multiple processes
  allowExitOnIdle: true,
  keepAlive: false,          // Disable keepAlive to free connections faster
  ssl: (() => {
    const sslFlag = process.env.DB_SSL ?? process.env.DATABASE_SSL;
    if (sslFlag === "true") {
      return { rejectUnauthorized: false };
    }

    try {
      const url = new URL(conn.connectionString);
      const sslmode = url.searchParams.get("sslmode");
      if (sslmode && sslmode !== "disable") {
        return { rejectUnauthorized: false };
      }
      if (url.hostname.includes("render.com")) {
        return { rejectUnauthorized: false };
      }
    } catch {
      // ignore parse errors and fall back to non-SSL
    }

    return false;
  })(),
});


pool.on("error", (err) => {
  const code = (err as any)?.code;
  // Transient errors (timeout, refused) should NOT permanently mark DB unavailable
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ECONNABORTED") {
    console.warn("[pg-pool] transient connection error:", code, err?.message || "");
    return;
  }
  console.error("[pg-pool] idle client error", err);
  if (isNetworkOrDnsError(err)) {
    markDbUnavailable(err?.message || "network/dns error", err);
  }
});

// Set search_path to 'drm' schema on every new connection
pool.on("connect", (client) => {
  client.on("error", (err) => {
    console.error("[pg-client] error on active client:", err?.message || err);
  });
  client.query("SET search_path TO drm, public").catch((err) => {
    console.error("[pg-client] failed to set search_path:", err?.message || err);
  });
});

if (process.env.DEBUG_PG_POOL === "true") {
  pool.on("connect", () => console.info("[pg-pool] connect"));
  pool.on("acquire", () => console.info("[pg-pool] acquire"));
  pool.on("remove", () => console.info("[pg-pool] remove"));
}

// Drain pool on process exit to free connections immediately (prevents EMAXCONNSESSION on hot reload)
const drainPool = () => { pool.end().catch(() => {}); };
process.once("SIGTERM", drainPool);
process.once("SIGINT", drainPool);
process.once("exit", drainPool);


export const db = drizzle(pool, { schema });

export async function checkDbHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = await pool.connect();
    await client.query("select 1");
    client.release();
    dbAvailable = true;
    dbUnavailableReason = null;
    lastHealthCheckAt = Date.now();
    return { ok: true };
  } catch (err: any) {
    markDbUnavailable(err?.message || "database unreachable", err);
    lastHealthCheckAt = Date.now();
    return { ok: false, error: err?.message || "database unreachable" };
  }
}
