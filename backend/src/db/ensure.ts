import { pool, isDbAvailable, isNetworkOrDnsError, markDbUnavailable } from "../db";

let ensurePromise: Promise<void> | null = null;

export async function ensureDbOnce(): Promise<void> {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    let client;
    try {
      client = await pool.connect();
      
      // Basic schema setup
      await client.query(`CREATE SCHEMA IF NOT EXISTS drm;`);
      
      console.log("[server] ensureDbOnce completed successfully. Migrations are now managed by drizzle-kit.");
    } catch (err: any) {
      if (isNetworkOrDnsError(err) || err.code === "ETIMEDOUT") {
        markDbUnavailable(err.message);
        console.warn("[server] DB unavailable during startup (ensureDbOnce), pool will retry:", err.message);
      } else {
        console.error("[server] ensureDbOnce error:", err);
      }
      throw err;
    } finally {
      if (client) {
        client.release();
      }
    }
  })();

  return ensurePromise;
}
