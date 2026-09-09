import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { transitionWorkflowStatus } from "./services/workflow-status.service";
import { ApiError } from "./utils/api-error";
import { pool } from "./db";
import { ensureDbOnce } from "./db/ensure";
import {
  WORKFLOW_ENTITY_TYPES,
  GM_WORKFLOW_STAGES,
} from "../shared/gm-sales-constants";

/**
 * Patch 5 Stage 6 (P14) — central workflow-status orchestrator.
 *
 * Two contracts are pinned here:
 *   1. The validation gate runs BEFORE any transaction opens, so an illegal
 *      transition / wrong role / missing reason throws ApiError and the
 *      delegated executor is NEVER invoked (no row is ever touched).
 *   2. The entity write (executor) and the workflow_status_history row commit or
 *      roll back together — a thrown executor leaves neither behind.
 */

describe("WorkflowStatusService.transition — validation gate (no DB write)", () => {
  it("rejects an illegal GM transition with 400 and never calls the executor", async () => {
    const execute = vi.fn();
    let caught: unknown;
    try {
      await transitionWorkflowStatus({
        entityType: WORKFLOW_ENTITY_TYPES.GM,
        entityId: randomUUID(),
        action: "GM_BAD",
        // PENDING_HOD -> APPROVED is not a legal GM edge.
        fromStatus: GM_WORKFLOW_STAGES.PENDING_HOD,
        toStatus: GM_WORKFLOW_STAGES.APPROVED,
        actor: { userId: randomUUID() },
        execute: execute as any,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects an unknown from-status with 400 and never calls the executor", async () => {
    const execute = vi.fn();
    let caught: unknown;
    try {
      await transitionWorkflowStatus({
        entityType: WORKFLOW_ENTITY_TYPES.GM,
        entityId: randomUUID(),
        action: "GM_BAD",
        fromStatus: "TOTALLY_UNKNOWN_STATUS",
        toStatus: GM_WORKFLOW_STAGES.PENDING_ACCOUNTS,
        actor: { userId: randomUUID() },
        execute: execute as any,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects a missing required reason with 400 and never calls the executor", async () => {
    const execute = vi.fn();
    let caught: unknown;
    try {
      await transitionWorkflowStatus({
        entityType: WORKFLOW_ENTITY_TYPES.GM,
        entityId: randomUUID(),
        action: "GM_REJECT",
        // A legal edge, so we reach (and fail) the reason check.
        fromStatus: GM_WORKFLOW_STAGES.PENDING_HOD,
        toStatus: GM_WORKFLOW_STAGES.REJECTED,
        actor: { userId: randomUUID() },
        requireReason: true,
        execute: execute as any,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects a wrong-role actor with 403 and never calls the executor", async () => {
    const execute = vi.fn();
    let caught: unknown;
    try {
      await transitionWorkflowStatus({
        entityType: WORKFLOW_ENTITY_TYPES.GM,
        entityId: randomUUID(),
        action: "GM_SUBMIT",
        fromStatus: GM_WORKFLOW_STAGES.PENDING_HOD,
        toStatus: GM_WORKFLOW_STAGES.PENDING_ACCOUNTS,
        actor: { userId: randomUUID(), roles: ["sales_executive"] },
        requiredRoles: ["admin"],
        execute: execute as any,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("WorkflowStatusService.transition — transactional atomicity (DB-backed)", () => {
  // A throwaway table the executor writes to, so we can prove the entity write
  // and the history row share one transaction. Entity type "TEST_SCRATCH" has no
  // canonical transition map, so validation is skipped and only the tx is tested.
  const TEST_ENTITY = "TEST_SCRATCH" as any;

  beforeAll(async () => {
    await ensureDbOnce();
    await pool.query(
      `CREATE TABLE IF NOT EXISTS drm.wf_status_test_scratch (id text PRIMARY KEY)`,
    );
  });

  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS drm.wf_status_test_scratch`);
    await pool.query(
      `DELETE FROM drm.workflow_status_history WHERE entity_type = $1`,
      [TEST_ENTITY],
    );
  });

  it("commits the executor write AND the history row together", async () => {
    const entityId = `test-${randomUUID()}`;
    const res = await transitionWorkflowStatus({
      entityType: TEST_ENTITY,
      entityId,
      action: "TEST_COMMIT",
      fromStatus: "A",
      toStatus: "B",
      actor: { userId: "" },
      module: "test",
      execute: async (client) => {
        await client.query(
          `INSERT INTO drm.wf_status_test_scratch (id) VALUES ($1)`,
          [entityId],
        );
        return { previousStatus: "A", nextStatus: "B" };
      },
    });

    expect(res.historyId).toBeTruthy();
    expect(res.previousStatus).toBe("A");
    expect(res.nextStatus).toBe("B");

    const scratch = await pool.query(
      `SELECT id FROM drm.wf_status_test_scratch WHERE id = $1`,
      [entityId],
    );
    expect(scratch.rows.length).toBe(1);

    const hist = await pool.query(
      `SELECT id, previous_status, next_status FROM drm.workflow_status_history WHERE entity_id = $1`,
      [entityId],
    );
    expect(hist.rows.length).toBe(1);
    expect(hist.rows[0].previous_status).toBe("A");
    expect(hist.rows[0].next_status).toBe("B");
  });

  it("rolls back the executor write AND writes no history row when the executor throws", async () => {
    const entityId = `test-${randomUUID()}`;
    let caught: unknown;
    try {
      await transitionWorkflowStatus({
        entityType: TEST_ENTITY,
        entityId,
        action: "TEST_ROLLBACK",
        fromStatus: "A",
        toStatus: "B",
        actor: { userId: "" },
        module: "test",
        execute: async (client) => {
          await client.query(
            `INSERT INTO drm.wf_status_test_scratch (id) VALUES ($1)`,
            [entityId],
          );
          throw new Error("boom");
        },
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("boom");

    const scratch = await pool.query(
      `SELECT id FROM drm.wf_status_test_scratch WHERE id = $1`,
      [entityId],
    );
    expect(scratch.rows.length).toBe(0);

    const hist = await pool.query(
      `SELECT id FROM drm.workflow_status_history WHERE entity_id = $1`,
      [entityId],
    );
    expect(hist.rows.length).toBe(0);
  });
});
