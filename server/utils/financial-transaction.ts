import type { PoolClient } from "pg";
import { db, pool } from "../db";

/**
 * Financial transaction helpers (PATCH 4 Stage 1).
 *
 * Standard way to run money-handling writes atomically. Two variants are
 * provided because the active backend mixes Drizzle (`db`) and raw
 * node-postgres (`pool.query`) data access:
 *
 *   - withFinancialTransaction: Drizzle transactions (use the `tx` argument
 *     for every write that must be atomic).
 *   - withPgTransaction: raw SQL transactions (use the `client` argument for
 *     every statement that must be atomic).
 *
 * HONESTY NOTE: a transaction only covers work performed on the supplied
 * `tx` / `client`. Any write that goes through the global `db`/`pool` (or a
 * helper that does) is NOT part of the transaction and will NOT roll back.
 * Do not wrap such work and claim atomicity.
 */

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run `fn` inside a Drizzle transaction. Commits on success, rolls back if
 * `fn` throws. Use the provided `tx` for all writes that must be atomic.
 */
export async function withFinancialTransaction<T>(
  fn: (tx: DrizzleTx) => Promise<T>,
): Promise<T> {
  return db.transaction((tx) => fn(tx));
}

/**
 * Run `fn` inside a raw node-postgres transaction (BEGIN / COMMIT, ROLLBACK on
 * throw). A dedicated client is checked out and always released. Use the
 * provided `client` for every statement that must be atomic.
 */
export async function withPgTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Swallow rollback errors so the original error is surfaced to the caller.
    }
    throw err;
  } finally {
    client.release();
  }
}
