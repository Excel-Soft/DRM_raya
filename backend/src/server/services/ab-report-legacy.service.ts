import type { Pool } from "pg";

/**
 * AB Report figures for the data copied from the old DRM (legacy_archive.webxl_*), computed with
 * the old system's own formulas (old func.php: CountAbCustomers, cash_in_hand_gm_pkr_all_over_*,
 * allChequesRemainPkrByTypeDATEWaise, buyer_total_dollar, webxl_required_dollars_to_pay, ...).
 * Checked against the old report for 2026-07-01..2026-09-30: every date-ranged figure matches;
 * "overall" figures (balance, required, partial-not-full, gap) are live state like the old page.
 *
 * Old-data notes: all columns are text; create_date / cheque_date hold local (PK) time and are
 * compared on their date part; MySQL reads dirty numbers loosely ('701..10' -> 701), mirrored by
 * LNUM; NULL vs '' is preserved from MySQL.
 */

const LNUM = (x: string) => `coalesce(substring(${x} from '^\\s*([-+]?[0-9]*\\.?[0-9]+)')::numeric, 0)`;
const NUM = (x: string) => `coalesce(nullif(replace(btrim(${x}), ',', ''), '')::numeric, 0)`;
const CASH = `('Cash Received', 'Online Paid')`;

export type CountAmount = { count: number; amount: number };

export type LegacyAbStats = {
  clientFull: CountAmount & { usd: number };
  clientLoanFirst: CountAmount & { usd: number };
  clientPartial: CountAmount & { usd: number };
  chequeUsed: CountAmount;
  chequeUnused: CountAmount;
  closingChequeUsed: CountAmount;
  closingChequeUnused: CountAmount;
  loanRecovered: CountAmount;
  loanPayment: CountAmount;
  dollarRate: number;
  buy: CountAmount;
  martiniShow: CountAmount;
  martiniNotShow: CountAmount;
  martiniRefund: CountAmount;
  accountPaid: CountAmount;
  martiniPending: CountAmount; // PKR
  balanceCount: number;
  balanceCurrent: CountAmount;
  balanceLast: CountAmount;
  balanceOther: CountAmount;
  requiredFull: CountAmount;
  requiredPartial: CountAmount;
  tempGm: CountAmount;
  tempGmByReason: { reason: string; count: number; amount: number }[];
  advancePay: CountAmount;
  extraDiscount: CountAmount & { pkr: number };
  extraDiscountPaid: CountAmount & { pkr: number };
  pendingRecovery: { count: number; usd: number; pkr: number };
  refund: number;
  totalDollarPkr: number;
  partialNotFull: number;
};

const TEMP_REASONS = [
  "leads transfer issue",
  "company is not registered yet",
  "wrong info added by the Sales",
  "gm not add by the Sales",
];

/** Previous calendar quarter relative to `d` (old getLastQuarterDates). */
export function previousQuarter(d = new Date()): { start: string; end: string } {
  const q = Math.floor(d.getMonth() / 3);
  const year = q === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const lq = q === 0 ? 3 : q - 1;
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { start: iso(new Date(year, lq * 3, 1)), end: iso(new Date(year, lq * 3 + 3, 0)) };
}

/**
 * @param start inclusive YYYY-MM-DD ("0001-01-01" for all time)
 * @param end   inclusive YYYY-MM-DD ("9999-12-31" for all time)
 */
export async function computeLegacyAbStats(pool: Pool, start: string, end: string): Promise<LegacyAbStats> {
  const lq = previousQuarter();
  const p = [start, end];
  const one = async (sql: string, params: any[] = p) => (await pool.query(sql, params)).rows[0] || {};
  const ca = (r: any, c = "c", a = "a"): CountAmount => ({ count: Number(r[c] || 0), amount: Number(r[a] || 0) });

  const [
    gm, inst, delay, chq, rec, loanPay, rate, buy, acctPaid, mPend, bal, reqP, reqF,
    temp, tempReasons, adv, exRec, exPaid, pend, refund, totalPkr, notFull,
  ] = await Promise.all([
    // Client payment rows by type (webxl_verify_gm, by create_date)
    one(`SELECT
           count(*) FILTER (WHERE webxl_behalf NOT IN ('Installment','Delay') OR webxl_behalf IS NULL) AS full_c,
           coalesce(sum(${NUM("amount")}) FILTER (WHERE webxl_behalf NOT IN ('Installment','Delay') OR webxl_behalf IS NULL), 0) AS full_a,
           coalesce(sum(${NUM("customer_dollars")}) FILTER (WHERE webxl_behalf NOT IN ('Installment','Delay') OR webxl_behalf IS NULL), 0) AS full_usd,
           count(*) FILTER (WHERE webxl_behalf = 'Installment') AS inst_c,
           count(*) FILTER (WHERE webxl_behalf = 'Delay') AS delay_c
         FROM legacy_archive.webxl_verify_gm
        WHERE acc_pay_status IN ${CASH} AND acc_disc_status = 'Approved'
          AND left(create_date, 10) BETWEEN $1 AND $2`),
    // Partial (installment) payments received (by current_pay_date)
    one(`SELECT coalesce(sum(${NUM("current_pkr")}), 0) AS a, coalesce(sum(${NUM("current_dollar_pay")}), 0) AS usd
           FROM legacy_archive.webxl_verify_gm_delay_amount
          WHERE delay_dollar_status = 'Installment' AND acc_status = 'Paid' AND cash_status IN ${CASH}
            AND current_pay_date BETWEEN $1 AND $2`),
    // Loan first payment received
    one(`SELECT coalesce(sum(${NUM("current_pkr")}), 0) AS a, coalesce(sum(${NUM("current_dollar_pay")}), 0) AS usd
           FROM legacy_archive.webxl_verify_gm_delay_amount
          WHERE delay_dollar_status = 'Delay' AND acc_status = 'Paid' AND cash_status IN ${CASH}
            AND current_pay_date BETWEEN $1 AND $2`),
    // Cheques (remain_amount, by cheque_date)
    one(`SELECT
           count(*) FILTER (WHERE cheque_type = 'For Dollar' AND cheque_status = 'used') AS used_c,
           coalesce(sum(${NUM("remain_amount")}) FILTER (WHERE cheque_type = 'For Dollar' AND cheque_status = 'used'), 0) AS used_a,
           count(*) FILTER (WHERE cheque_type = 'For Dollar' AND cheque_status = 'un-used') AS unused_c,
           coalesce(sum(${NUM("remain_amount")}) FILTER (WHERE cheque_type = 'For Dollar' AND cheque_status = 'un-used'), 0) AS unused_a,
           count(*) FILTER (WHERE cheque_type = 'Closing' AND cheque_status = 'used') AS cl_used_c,
           coalesce(sum(${NUM("remain_amount")}) FILTER (WHERE cheque_type = 'Closing' AND cheque_status = 'used'), 0) AS cl_used_a,
           count(*) FILTER (WHERE cheque_type = 'Closing' AND cheque_status = 'un-used') AS cl_unused_c,
           coalesce(sum(${NUM("remain_amount")}) FILTER (WHERE cheque_type = 'Closing' AND cheque_status = 'un-used'), 0) AS cl_unused_a
         FROM legacy_archive.webxl_cheque_system
        WHERE left(cheque_date, 10) BETWEEN $1 AND $2 AND ${NUM("remain_amount")} <> 0`),
    // Loan recovered (cash), by current_pay_date
    one(`SELECT count(*) AS c, coalesce(sum(${NUM("a.current_pkr")}), 0) AS a
           FROM legacy_archive.webxl_verify_gm_delay_amount a
           LEFT JOIN legacy_archive.webxl_verify_gm g ON g._source_table = 'webxl_verify_gm' AND g._legacy_pk = a.gmid
          WHERE a.delay_dollar_status = 'Delay' AND a.recovery_type = 'Cash' AND a.acc_status = 'Recoverd'
            AND a.cash_status <> 'Extra Discount Paid' AND g.acc_disc_status = 'Approved' AND g.ceo_disc_status = 'Approved'
            AND a.current_pay_date BETWEEN $1 AND $2`),
    // Loan payment (not yet paid loans of GMs created in range)
    one(`SELECT count(*) AS c, coalesce(sum(${NUM("a.delay_pkr")}), 0) AS a
           FROM legacy_archive.webxl_verify_gm_delay_amount a
           LEFT JOIN legacy_archive.webxl_verify_gm g ON g._source_table = 'webxl_verify_gm' AND g._legacy_pk = a.gmid
          WHERE a.delay_dollar_status = 'Delay'
            AND (a.acc_status IS NULL OR a.acc_status = '' OR a.acc_status <> 'Paid')
            AND (a.cash_status IS NULL OR a.cash_status = '' OR a.cash_status <> 'Extra Discount Paid')
            AND g.acc_disc_status = 'Approved' AND g.ceo_disc_status = 'Approved'
            AND left(g.create_date, 10) BETWEEN $1 AND $2`),
    one(`SELECT ${NUM("doller")} AS rate FROM legacy_archive.webxl_currency WHERE id = '1'`, []),
    // Dollars bought (received history, by buy_date) incl. Martini split
    one(`SELECT
           count(*) FILTER (WHERE show_ab = 'Show') AS buy_c,
           coalesce(sum(${NUM("dollars")}) FILTER (WHERE show_ab = 'Show'), 0) AS buy_a,
           count(*) FILTER (WHERE show_ab = 'Show' AND ${NUM("dollars")} <> 0) AS show_c,
           count(*) FILTER (WHERE show_ab = 'Not Show' AND ${NUM("dollars")} <> 0) AS notshow_c,
           coalesce(sum(${NUM("dollars")}) FILTER (WHERE show_ab = 'Not Show'), 0) AS notshow_a,
           count(*) FILTER (WHERE show_ab = 'Refund' AND ${NUM("dollars")} <> 0) AS refund_c,
           coalesce(sum(${NUM("dollars")}) FILTER (WHERE show_ab = 'Refund'), 0) AS refund_a
         FROM legacy_archive.webxl_dollars_received_history
        WHERE buy_date BETWEEN $1 AND $2`),
    // Martini Show & account paid (by acc_pay_date)
    one(`SELECT count(*) FILTER (WHERE ${NUM("dollars")} <> 0) AS c, coalesce(sum(${NUM("dollars")}), 0) AS a
           FROM legacy_archive.webxl_dollars_received_history
          WHERE show_ab = 'Show' AND acc_pay_date >= $1 AND acc_pay_date <= $2`),
    // Martini pending: bought, account has not paid the buyer yet
    one(`SELECT count(*) AS c, coalesce(sum(${NUM("pkr_amount")}), 0) AS a
           FROM legacy_archive.webxl_dollars_received_history
          WHERE show_ab = 'Show' AND buy_date BETWEEN $1 AND $2 AND acc_pay_pkr IS NULL`),
    // Dollar balance: remaining dollars of buyer slots (current range + previous quarter)
    one(`SELECT
           (SELECT count(*) FROM legacy_archive.webxl_dollar_buyer_dollars WHERE show_ab = 'Show' AND ${NUM("dollars")} <> 0) AS cnt,
           count(*) FILTER (WHERE buy_date BETWEEN $1 AND $2 AND ${NUM("dollars")} <> 0) AS cur_c,
           coalesce(sum(${NUM("dollars")}) FILTER (WHERE buy_date BETWEEN $1 AND $2), 0) AS cur_a,
           count(*) FILTER (WHERE buy_date BETWEEN $3 AND $4 AND ${NUM("dollars")} <> 0) AS last_c,
           coalesce(sum(${NUM("dollars")}) FILTER (WHERE buy_date BETWEEN $3 AND $4), 0) AS last_a,
           -- slots outside both windows: in the old count, not in the old amount
           count(*) FILTER (WHERE ${NUM("dollars")} <> 0 AND NOT (buy_date BETWEEN $1 AND $2) AND NOT (buy_date BETWEEN $3 AND $4)) AS oth_c,
           coalesce(sum(${NUM("dollars")}) FILTER (WHERE NOT (buy_date BETWEEN $1 AND $2) AND NOT (buy_date BETWEEN $3 AND $4)), 0) AS oth_a
         FROM legacy_archive.webxl_dollar_buyer_dollars
        WHERE show_ab = 'Show'`, [start, end, lq.start, lq.end]),
    // Required to pay (overall): partial installments paid by client, Alibaba pending
    one(`SELECT count(DISTINCT gmid) AS c, coalesce(sum(${NUM("current_dollar_pay")}), 0) AS a
           FROM legacy_archive.webxl_verify_gm_delay_amount
          WHERE cash_status <> 'Customer Paid' AND delay_dollar_status = 'Installment' AND acc_status = 'Paid'
            AND alibaba = 'Pending' AND ab_confirm_status IS NULL`, []),
    // Required to pay (overall): full GMs approved but not paid to Alibaba
    one(`SELECT count(*) AS c, coalesce(sum(${NUM("price")}), 0) AS a
           FROM legacy_archive.webxl_verify_gm
          WHERE webxl_pay_status = 'Pending' AND acc_disc_status = 'Approved' AND ceo_disc_status = 'Approved'
            AND webxl_behalf <> 'Installment'`, []),
    // Temp GM still open (overall)
    one(`SELECT count(*) AS c, coalesce(sum(${NUM("amount")}), 0) AS a
           FROM legacy_archive.webxl_tem_gm
          WHERE amount_type = 'Pkr' AND ${NUM("amount")} > 0 AND status NOT IN ('deleted','clear')
            AND reasion = ANY($1::text[])`, [TEMP_REASONS]),
    pool.query(`SELECT reasion AS reason, count(*)::int AS count, coalesce(sum(${NUM("amount")}), 0)::float AS amount
                  FROM legacy_archive.webxl_tem_gm
                 WHERE amount_type = 'Pkr' AND ${NUM("amount")} > 0 AND status NOT IN ('deleted','clear')
                   AND reasion = ANY($1::text[])
                 GROUP BY 1 ORDER BY 3 DESC`, [TEMP_REASONS]).then((r) => r.rows),
    one(`SELECT count(*) AS c, coalesce(sum(${NUM("remain_amount")}), 0) AS a
           FROM legacy_archive.webxl_dollar_advance_pay
          WHERE ${NUM("remain_amount")} > 0 AND status NOT IN ('deleted','clear') AND pay_date BETWEEN $1 AND $2`),
    // Extra discount received (by create_date)
    one(`SELECT count(*) AS c, coalesce(sum(${LNUM("extra_discount")}), 0) AS a, coalesce(sum(${LNUM("extra_pkr_discount")}), 0) AS pkr
           FROM legacy_archive.webxl_verify_gm
          WHERE ${LNUM("extra_discount")} > 0 AND acc_disc_status = 'Approved' AND ceo_disc_status = 'Approved'
            AND left(create_date, 10) BETWEEN $1 AND $2`),
    // Extra discount paid (by pay_date)
    one(`SELECT count(*) AS c, coalesce(sum(${LNUM("extra_discount")}), 0) AS a, coalesce(sum(${LNUM("extra_pkr_discount")}), 0) AS pkr
           FROM legacy_archive.webxl_verify_gm
          WHERE ${LNUM("extra_discount")} > 0 AND acc_disc_status = 'Approved' AND ceo_disc_status = 'Approved'
            AND alibaba = 'Yes' AND left(pay_date, 10) BETWEEN $1 AND $2`),
    // Pending loan recovery (overall)
    one(`SELECT count(*) AS c, coalesce(sum(${NUM("a.delay_dollars")}), 0) AS usd, coalesce(sum(${NUM("a.delay_pkr")}), 0) AS pkr
           FROM legacy_archive.webxl_verify_gm_delay_amount a
           LEFT JOIN legacy_archive.webxl_verify_gm g ON g._source_table = 'webxl_verify_gm' AND g._legacy_pk = a.gmid
          WHERE a.delay_dollar_status = 'Delay' AND a.acc_status = 'Pending'
            AND g.acc_disc_status = 'Approved' AND g.ceo_disc_status = 'Approved'`, []),
    one(`SELECT coalesce(sum(${NUM("amount")}), 0) AS a FROM legacy_archive.webxl_refund_gm
          WHERE ${NUM("amount")} > 0 AND status <> 'deleted' AND left(create_at, 10) BETWEEN $1 AND $2`),
    // Total dollar PKR paid by account (by acc_pay_date)
    one(`SELECT coalesce(sum(${NUM("acc_pay_pkr")}), 0) AS a FROM legacy_archive.webxl_dollars_received_history
          WHERE show_ab = 'Show' AND acc_pay_date >= $1 AND acc_pay_date <= $2`),
    // Partial payment not full yet (overall, USD)
    one(`SELECT coalesce(round(sum(total_paid)), 0) AS a FROM (
           SELECT a.gmid, sum(${NUM("a.current_dollar_pay")}) AS total_paid
             FROM legacy_archive.webxl_verify_gm_delay_amount a
             LEFT JOIN legacy_archive.webxl_verify_gm g ON g._source_table = 'webxl_verify_gm' AND g._legacy_pk = a.gmid
            WHERE a.acc_status = 'Paid' AND a.alibaba = 'Pending' AND a.cash_status IN ${CASH}
              AND a.delay_dollar_status = 'Installment' AND g.acc_disc_status = 'Pending'
            GROUP BY a.gmid
           HAVING sum(${NUM("a.current_dollar_pay")}) <
                  (SELECT sum(${NUM("s.delay_dollars")}) FROM legacy_archive.webxl_verify_gm_delay_amount s WHERE s.gmid = a.gmid)
         ) t`, []),
  ]);

  return {
    clientFull: { count: Number(gm.full_c || 0), amount: Number(gm.full_a || 0), usd: Number(gm.full_usd || 0) },
    clientLoanFirst: { count: Number(gm.delay_c || 0), amount: Number(delay.a || 0), usd: Number(delay.usd || 0) },
    clientPartial: { count: Number(gm.inst_c || 0), amount: Number(inst.a || 0), usd: Number(inst.usd || 0) },
    chequeUsed: ca(chq, "used_c", "used_a"),
    chequeUnused: ca(chq, "unused_c", "unused_a"),
    closingChequeUsed: ca(chq, "cl_used_c", "cl_used_a"),
    closingChequeUnused: ca(chq, "cl_unused_c", "cl_unused_a"),
    loanRecovered: ca(rec),
    loanPayment: ca(loanPay),
    dollarRate: Number(rate.rate || 0),
    buy: ca(buy, "buy_c", "buy_a"),
    martiniShow: ca(buy, "show_c", "buy_a"),
    martiniNotShow: ca(buy, "notshow_c", "notshow_a"),
    martiniRefund: ca(buy, "refund_c", "refund_a"),
    accountPaid: ca(acctPaid),
    martiniPending: ca(mPend),
    balanceCount: Number(bal.cnt || 0),
    balanceCurrent: ca(bal, "cur_c", "cur_a"),
    balanceLast: ca(bal, "last_c", "last_a"),
    balanceOther: ca(bal, "oth_c", "oth_a"),
    requiredFull: ca(reqF),
    requiredPartial: ca(reqP),
    tempGm: ca(temp),
    tempGmByReason: tempReasons as any,
    advancePay: ca(adv),
    extraDiscount: { ...ca(exRec), pkr: Number(exRec.pkr || 0) },
    extraDiscountPaid: { ...ca(exPaid), pkr: Number(exPaid.pkr || 0) },
    pendingRecovery: { count: Number(pend.c || 0), usd: Number(pend.usd || 0), pkr: Number(pend.pkr || 0) },
    refund: Number(refund.a || 0),
    totalDollarPkr: Number(totalPkr.a || 0),
    partialNotFull: Number(notFull.a || 0),
  };
}
