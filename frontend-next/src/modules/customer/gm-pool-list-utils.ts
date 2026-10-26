import type { GmPoolRow } from "./gm-pool-constants";

export type ApprovalTone = "ok" | "bad" | "warn";

export function formatGmRounded(val: unknown): string {
  if (val == null || val === "" || val === "-") return "—";
  const num = Number(val);
  if (!Number.isFinite(num)) return String(val);
  return String(Math.round(num));
}

export function getHodApprovalLabel(row: GmPoolRow): { text: string; tone: ApprovalTone } {
  const approvalStatus = (row.approvalStatus || "").toLowerCase().trim();
  if (approvalStatus === "rejected_by_hod") return { text: "HOD Rejected", tone: "bad" };
  if (!approvalStatus || approvalStatus === "pending_hod") return { text: "HOD Pending", tone: "warn" };
  return { text: "HOD Approved", tone: "ok" };
}

export function getAccountApprovalLabel(row: GmPoolRow): { text: string; tone: ApprovalTone } {
  const approvalStatus = (row.approvalStatus || "").toLowerCase().trim();
  const accountManagerStatus = (row.accountManagerStatus || "").toLowerCase().trim();
  if (accountManagerStatus === "rejected" || approvalStatus === "rejected_by_account_manager") {
    return { text: "Account Rejected", tone: "bad" };
  }
  if (
    accountManagerStatus === "approved" ||
    approvalStatus === "pending_super_hod" ||
    approvalStatus === "approved"
  ) {
    return { text: "Account Approved", tone: "ok" };
  }
  return { text: "Account Pending", tone: "warn" };
}

export function getLatestPayDate(row: GmPoolRow): string {
  const installments = Array.isArray(row.installments) ? row.installments : [];
  const payDates = installments
    .map((inst) => (inst as { payDate?: string }).payDate)
    .filter((d): d is string => typeof d === "string" && d.trim().length > 0);
  if (payDates.length === 0) return "—";
  return payDates[payDates.length - 1];
}

export function gmRowActionState(row: GmPoolRow) {
  const status = (row.approvalStatus || "").toLowerCase().trim();
  const finalStatus = (row.finalStatus || "").toLowerCase().trim();
  const hodStatus = (row.hodStatus || "").toLowerCase().trim();
  const rawStatus = (row.rawStatus || "").toLowerCase().trim();

  const isRejected =
    (row.status || "").toLowerCase().includes("rejected") ||
    status.includes("rejected") ||
    hodStatus.includes("rejected") ||
    finalStatus.includes("rejected");

  const { tone: hodTone } = getHodApprovalLabel(row);
  const isHodApproved =
    !isRejected &&
    (hodTone === "ok" ||
      hodStatus.includes("approved") ||
      status === "pending_managers" ||
      status === "pending_account" ||
      status === "pending_super_hod" ||
      status === "approved" ||
      finalStatus === "approved");

  const isApproved = status === "approved" || finalStatus === "approved";
  const isWithdrawnReset = row.withdrawalStatus === "approved" && status === "pending_hod" && rawStatus === "withdrawn";

  const canEdit = isRejected || isWithdrawnReset || row.updateRequestStatus === "super_hod_approved";
  const canWithdraw = isHodApproved || isRejected;
  const canDelete =
    !isHodApproved && (isRejected || isWithdrawnReset || row.updateRequestStatus === "super_hod_approved");
  const updatePending = row.updateRequestStatus === "pending_super_hod";
  const canRequestUpdate = isApproved && row.updateRequestStatus !== "super_hod_approved" && !updatePending;
  const isHodRejected = status === "rejected_by_hod" || isWithdrawnReset;

  return {
    canEdit,
    canWithdraw,
    canDelete,
    canRequestUpdate,
    updatePending,
    isHodRejected,
    isHodApproved,
  };
}
