/**
 * Copilot V1 — M4 optional-write validation logic, with persistence and the
 * ownership check mocked so these are fast, deterministic unit tests of the
 * proposal/confirmation state machine itself (expiry, payload-hash
 * mismatch, non-pending status, idempotent concurrent-confirm fallback) —
 * not of Postgres.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../utils/ownership", () => ({
  assertCanEditCustomer: vi.fn().mockResolvedValue("owner-1"),
}));

// Must mock the DB pool too — this test asserts confirmFollowupAction's state
// machine (claim/execute/idempotency), not a real insert. Without this mock,
// the "execute" path below would issue a real `insert into drm.follow_ups`
// against the live database configured in .env.
const mockPoolQuery = vi.fn().mockResolvedValue({ rows: [{ id: "fu-1" }] });
vi.mock("../db", () => ({
  pool: { query: (...args: any[]) => mockPoolQuery(...args) },
}));

const mockGetProposalForUser = vi.fn();
const mockClaimProposalForExecution = vi.fn();
const mockRecordExecution = vi.fn();
const mockGetExecutionForProposal = vi.fn();
const mockMarkProposalStatus = vi.fn();

vi.mock("../services/copilot/persistence", () => ({
  createProposal: vi.fn(),
  getProposalForUser: (...args: any[]) => mockGetProposalForUser(...args),
  claimProposalForExecution: (...args: any[]) => mockClaimProposalForExecution(...args),
  recordExecution: (...args: any[]) => mockRecordExecution(...args),
  getExecutionForProposal: (...args: any[]) => mockGetExecutionForProposal(...args),
  markProposalStatus: (...args: any[]) => mockMarkProposalStatus(...args),
  hashPayload: (payload: unknown) => `hash:${JSON.stringify(payload)}`,
}));

import { confirmFollowupAction, ProposalInvalidError } from "../services/copilot/followup-action";

const baseProposal = {
  id: "proposal-1",
  userId: "user-1",
  actionType: "create_followup",
  payload: { customerId: "cust-1", note: "Call back", method: "Call", dueAt: "2026-11-01T00:00:00.000Z" },
  payloadHash: `hash:${JSON.stringify({ customerId: "cust-1", note: "Call back", method: "Call", dueAt: "2026-11-01T00:00:00.000Z" })}`,
  status: "pending",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

const fakeReq = {} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockPoolQuery.mockResolvedValue({ rows: [{ id: "fu-1" }] });
});

describe("confirmFollowupAction", () => {
  it("rejects when the proposal does not exist for this user", async () => {
    mockGetProposalForUser.mockResolvedValue(null);
    await expect(
      confirmFollowupAction({ req: fakeReq, userId: "user-1", proposalId: "nope", payloadHash: "x" }),
    ).rejects.toThrow(ProposalInvalidError);
  });

  it("rejects an expired proposal even if the hash matches", async () => {
    mockGetProposalForUser.mockResolvedValue({ ...baseProposal, expiresAt: new Date(Date.now() - 1000).toISOString() });
    await expect(
      confirmFollowupAction({ req: fakeReq, userId: "user-1", proposalId: "proposal-1", payloadHash: baseProposal.payloadHash }),
    ).rejects.toMatchObject({ code: "expired" });
  });

  it("rejects when the client-echoed payload hash doesn't match the stored proposal (changed/stale)", async () => {
    mockGetProposalForUser.mockResolvedValue(baseProposal);
    await expect(
      confirmFollowupAction({ req: fakeReq, userId: "user-1", proposalId: "proposal-1", payloadHash: "stale-hash" }),
    ).rejects.toMatchObject({ code: "changed" });
  });

  it("claims and executes exactly once for a fresh pending proposal", async () => {
    mockGetProposalForUser.mockResolvedValue(baseProposal);
    mockClaimProposalForExecution.mockResolvedValue(true);
    mockRecordExecution.mockResolvedValue({ status: "success", resultEntityId: "fu-1" });

    const result = await confirmFollowupAction({
      req: fakeReq,
      userId: "user-1",
      proposalId: "proposal-1",
      payloadHash: baseProposal.payloadHash,
    });

    expect(mockClaimProposalForExecution).toHaveBeenCalledWith("proposal-1");
    expect(mockRecordExecution).toHaveBeenCalledWith(
      expect.objectContaining({ proposalId: "proposal-1", actionKey: "followup:proposal-1" }),
    );
    expect(mockMarkProposalStatus).toHaveBeenCalledWith("proposal-1", "executed");
    expect(result).toEqual({ status: "success", resultEntityId: "fu-1" });
  });

  it("a concurrent confirm that loses the atomic claim returns the winner's execution instead of double-inserting", async () => {
    mockGetProposalForUser.mockResolvedValue(baseProposal);
    mockClaimProposalForExecution.mockResolvedValue(false); // lost the race
    mockGetExecutionForProposal.mockResolvedValue({ status: "success", resultEntityId: "fu-1" });

    const result = await confirmFollowupAction({
      req: fakeReq,
      userId: "user-1",
      proposalId: "proposal-1",
      payloadHash: baseProposal.payloadHash,
    });

    expect(mockRecordExecution).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "success", resultEntityId: "fu-1" });
  });

  it("a retry on an already-executed proposal returns the existing execution instead of erroring", async () => {
    mockGetProposalForUser.mockResolvedValue({ ...baseProposal, status: "executed" });
    mockGetExecutionForProposal.mockResolvedValue({ status: "success", resultEntityId: "fu-1" });

    const result = await confirmFollowupAction({
      req: fakeReq,
      userId: "user-1",
      proposalId: "proposal-1",
      payloadHash: baseProposal.payloadHash,
    });

    expect(mockClaimProposalForExecution).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "success", resultEntityId: "fu-1" });
  });
});
