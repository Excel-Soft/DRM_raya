/**
 * Patch 6 Stage 7 — pure Trial Balance aggregation.
 *
 * Kept DB-free so it can be unit-tested with fixtures. The route layer
 * (server/office-account-routes.ts) loads account heads + ledger rows and hands
 * them here. The formula and its invariants are documented in
 * TRIAL_BALANCE_FORMULA.md. Summary:
 *
 *  - `account_heads.openingBalance` is the non-ledger cutover/master opening and
 *    is NOT re-posted into `ledger_entries`. Opening therefore =
 *    signed(openingBalance) + ledger movement strictly BEFORE `start`. This is
 *    the single source of truth for the opening figure (no double counting).
 *  - All ledger statuses are included so a reversal (the original row flips to
 *    "Reversed" and an opposite "Reversal" row is added) nets to zero — matching
 *    the existing /ledger/summary behaviour.
 *  - Totals are computed over the full filtered set; the route paginates the
 *    returned rows AFTER calling this function, never the totals.
 *  - Amounts are never converted across currencies here; the route inspects the
 *    ledger currencies separately and emits a currencyWarning when more than one
 *    appears, because a mixed-currency total would be meaningless.
 */

/** account_head categories whose natural (normal) balance is a debit. */
export const TRIAL_BALANCE_DEBIT_CATEGORIES = new Set(["Assets", "Expenses"]);

export interface TrialBalanceAccount {
  id: string;
  code: string | null;
  name: string | null;
  category: string | null;
  normalBalance: string | null;
  openingBalance: string | null;
}

export interface TrialBalanceLedgerRow {
  accountHeadId: string | null;
  entryType: string; // "Debit" | "Credit"
  amount: string | null;
  date: Date | string | null;
}

export interface TrialBalanceRow {
  accountHeadId: string;
  code: string | null;
  name: string | null;
  category: string | null;
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
}

export interface TrialBalanceTotals {
  openingDebit: string;
  openingCredit: string;
  periodDebit: string;
  periodCredit: string;
  closingDebit: string;
  closingCredit: string;
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totals: TrialBalanceTotals;
  imbalance: boolean;
  imbalanceAmount: string;
}

/** A debit-normal head increases with debits; opening balance is positive-debit. */
export function isDebitNormal(acc: TrialBalanceAccount): boolean {
  if (acc.normalBalance === "Debit") return true;
  if (acc.normalBalance === "Credit") return false;
  // Fallback for heads created before normalBalance was populated.
  return TRIAL_BALANCE_DEBIT_CATEGORIES.has(String(acc.category ?? ""));
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function toDate(value: Date | string | null): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Compute a trial balance. `start`/`end` are inclusive boundaries already
 * resolved by the caller (end should be the end-of-day instant).
 */
export function computeTrialBalance(
  accounts: TrialBalanceAccount[],
  ledger: TrialBalanceLedgerRow[],
  opts: { start: Date | null; end: Date | null; includeZeroBalance: boolean },
): TrialBalanceResult {
  const { start, end, includeZeroBalance } = opts;

  // Per-head accumulators. openingNet is signed: positive => debit balance.
  const openingNet = new Map<string, number>();
  const periodDebit = new Map<string, number>();
  const periodCredit = new Map<string, number>();

  // Seed opening from each head's master opening balance.
  for (const acc of accounts) {
    const ob = Number(acc.openingBalance) || 0;
    openingNet.set(acc.id, isDebitNormal(acc) ? ob : -ob);
  }

  for (const row of ledger) {
    const headId = row.accountHeadId;
    if (!headId || !openingNet.has(headId)) continue; // ignore entries off-chart
    const amt = Number(row.amount) || 0;
    if (!amt) continue;
    const isDebit = row.entryType === "Debit";
    const signed = isDebit ? amt : -amt;
    const d = toDate(row.date);

    if (start && d && d < start) {
      // strictly before the period => folds into opening
      openingNet.set(headId, (openingNet.get(headId) || 0) + signed);
      continue;
    }
    if (end && d && d > end) continue; // after the period => ignored
    if (start && d && d < start) continue; // (already handled) guard
    // within [start, end] (or unbounded)
    if (isDebit) periodDebit.set(headId, (periodDebit.get(headId) || 0) + amt);
    else periodCredit.set(headId, (periodCredit.get(headId) || 0) + amt);
  }

  const rows: TrialBalanceRow[] = [];
  let tOpenDr = 0, tOpenCr = 0, tPerDr = 0, tPerCr = 0, tCloseDr = 0, tCloseCr = 0;

  for (const acc of accounts) {
    const open = round2(openingNet.get(acc.id) || 0);
    const pDr = round2(periodDebit.get(acc.id) || 0);
    const pCr = round2(periodCredit.get(acc.id) || 0);
    const close = round2(open + pDr - pCr);

    const openDr = open >= 0 ? open : 0;
    const openCr = open < 0 ? -open : 0;
    const closeDr = close >= 0 ? close : 0;
    const closeCr = close < 0 ? -close : 0;

    if (!includeZeroBalance && open === 0 && pDr === 0 && pCr === 0 && close === 0) {
      continue;
    }

    tOpenDr += openDr; tOpenCr += openCr;
    tPerDr += pDr; tPerCr += pCr;
    tCloseDr += closeDr; tCloseCr += closeCr;

    rows.push({
      accountHeadId: acc.id,
      code: acc.code,
      name: acc.name,
      category: acc.category,
      openingDebit: openDr.toFixed(2),
      openingCredit: openCr.toFixed(2),
      periodDebit: pDr.toFixed(2),
      periodCredit: pCr.toFixed(2),
      closingDebit: closeDr.toFixed(2),
      closingCredit: closeCr.toFixed(2),
    });
  }

  const imbalanceAmount = round2(tCloseDr - tCloseCr);
  return {
    rows,
    totals: {
      openingDebit: round2(tOpenDr).toFixed(2),
      openingCredit: round2(tOpenCr).toFixed(2),
      periodDebit: round2(tPerDr).toFixed(2),
      periodCredit: round2(tPerCr).toFixed(2),
      closingDebit: round2(tCloseDr).toFixed(2),
      closingCredit: round2(tCloseCr).toFixed(2),
    },
    imbalance: Math.abs(imbalanceAmount) > 0.01,
    imbalanceAmount: imbalanceAmount.toFixed(2),
  };
}
