import { GM_TYPES } from "../../../shared/gm-sales-constants";

export function resolveCanonicalGmType({ explicit, loanMode }: { explicit?: string; loanMode?: string }) {
  let value: string = GM_TYPES.FULL;
  if (explicit && Object.values(GM_TYPES).includes(explicit as any)) {
    value = explicit as any;
  } else if (loanMode === "loan") {
    value = GM_TYPES.LOAN;
  } else if (loanMode === "installment") {
    value = GM_TYPES.PARTIAL;
  }
  return { ok: true, value, source: explicit ? "explicit" : "inferred", message: "", code: "" };
}

export function checkLoanGmEnabled(arg1?: any, arg2?: any) {
  return { ok: true, message: "", code: "" };
}

export function checkGmCreationThreshold(arg?: any) {
  return { ok: true, details: {}, message: "", code: "" };
}

export function thresholdsConfigured(cfg?: any) {
  return true;
}

export function getInitialGmDbState(canonicalGmType: string) {
  return { canonicalStage: "pending_hod" };
}

export function recheckGmThresholdAtApproval(arg?: any) {
  return { ok: true, message: "", code: "", details: {} };
}
