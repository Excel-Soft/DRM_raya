import { GM_TYPES } from "../../../shared/gm-sales-constants";

export function resolveCanonicalGmType({ explicit, loanMode }: { explicit?: string; loanMode?: string }) {
  let value = GM_TYPES.FULL;
  if (explicit && Object.values(GM_TYPES).includes(explicit as any)) {
    value = explicit as any;
  } else if (loanMode === "loan") {
    value = GM_TYPES.LOAN;
  } else if (loanMode === "installment") {
    value = GM_TYPES.PARTIAL;
  }
  return { ok: true, value, source: explicit ? "explicit" : "inferred" };
}

export function checkLoanGmEnabled() {
  return { ok: true };
}

export function checkGmCreationThreshold() {
  return { ok: true, details: {} };
}

export function thresholdsConfigured() {
  return true;
}

export function getInitialGmDbState(canonicalGmType: string) {
  return { canonicalStage: "pending_hod" };
}

export function recheckGmThresholdAtApproval() {
  return { ok: true };
}
