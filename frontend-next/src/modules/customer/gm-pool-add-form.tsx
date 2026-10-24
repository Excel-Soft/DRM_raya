"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GmCompanySearch } from "./gm-company-search";
import {
  GM_DROPOUT_OPTIONS,
  GM_EXTENSION_OPTIONS,
  GM_PAYMENT_STATUSES,
  GM_TYPES,
  type GmFormState,
  type GmPackage,
} from "./gm-pool-constants";
import { computeGmNumericValues, EMPTY_GM_LOAN_ROW, type GmLoanRow } from "./gm-pool-numeric";

type Props = {
  form: GmFormState;
  setField: <K extends keyof GmFormState>(key: K, value: GmFormState[K]) => void;
  packages: GmPackage[];
  fieldErrors: Record<string, string>;
  loanRows: GmLoanRow[];
  setLoanRows: Dispatch<SetStateAction<GmLoanRow[]>>;
  editRowId: string | null;
  duplicateHints: { memberId?: boolean; orderId?: boolean; companyBlock?: boolean; companyMessage?: string };
  paymentProof: File | null;
  onPaymentProofChange: (file: File | null) => void;
  paymentProofError?: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
};

export function GmPoolAddForm({
  form,
  setField,
  packages,
  fieldErrors,
  loanRows,
  setLoanRows,
  editRowId,
  duplicateHints,
  paymentProof,
  onPaymentProofChange,
  paymentProofError,
  submitting,
  onSubmit,
  onCancel,
}: Props) {
  const showPaymentUpload =
    form.paymentStatus === "Online Paid" || form.paymentStatus === "Customer Paid";
  const selectedPackage = packages.find((p) => p.id === form.packageId);
  const numericValues = computeGmNumericValues(
    form.pkrAmount,
    form.dollarRate,
    form.alibabaDiscount,
    selectedPackage,
  );

  useEffect(() => {
    if (!selectedPackage) return;
    if (form.loanMode === "none") {
      setLoanRows((prev) => {
        const row0 = prev[0] ?? EMPTY_GM_LOAN_ROW;
        const dollar = numericValues.extraDollarDiscount;
        const pkr = dollar * numericValues.dollarRateNum;
        return [{ ...row0, dollar: dollar.toString(), pkrAmount: pkr > 0 ? pkr.toFixed(0) : "" }];
      });
      return;
    }
    if (form.loanMode === "loan") {
      setLoanRows((prev) => {
        const dollarVal = numericValues.finalOrderDollar;
        const pkrVal = dollarVal * numericValues.dollarRateNum;
        const row0 = prev[0] ?? EMPTY_GM_LOAN_ROW;
        return [{ ...row0, dollar: dollarVal.toString(), pkrAmount: pkrVal > 0 ? pkrVal.toFixed(0) : "" }, ...prev.slice(1)];
      });
    } else if (form.loanMode === "installment") {
      setLoanRows((prev) => {
        const dollar1 = numericValues.extraDollarDiscount;
        const dollar2 = numericValues.customerDollar;
        const pkr1 = dollar1 * numericValues.dollarRateNum;
        const pkr2 = dollar2 * numericValues.dollarRateNum;
        const row0 = prev[0] ?? EMPTY_GM_LOAN_ROW;
        const row1 = prev[1] ?? EMPTY_GM_LOAN_ROW;
        return [
          { ...row0, dollar: dollar1.toString(), pkrAmount: pkr1 > 0 ? pkr1.toFixed(0) : "" },
          { ...row1, dollar: dollar2.toString(), pkrAmount: pkr2 > 0 ? pkr2.toFixed(0) : "" },
          ...prev.slice(2),
        ];
      });
    }
  }, [
    selectedPackage,
    form.loanMode,
    numericValues.finalOrderDollar,
    numericValues.extraDollarDiscount,
    numericValues.customerDollar,
    numericValues.dollarRateNum,
    setLoanRows,
  ]);

  const totalInstallmentDollar = loanRows.reduce((sum, row) => sum + (Number(row.dollar) || 0), 0);
  const remaining = numericValues.finalOrderDollar - totalInstallmentDollar;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{editRowId ? "Edit / Resubmit GM" : "Add GM"}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field id="gm-company" label="Company *" error={fieldErrors.companyName || duplicateHints.companyMessage}>
          <GmCompanySearch
            companyId={form.companyId}
            companyLabel={form.companyName}
            error={fieldErrors.companyName}
            onSelect={(id, label) => {
              setField("companyId", id);
              setField("companyName", label);
            }}
          />
          {editRowId ? <p className="text-xs text-zinc-500">Company locked while editing.</p> : null}
        </Field>
        <Field id="gm-member" label="Member Id *" error={fieldErrors.memberId || (duplicateHints.memberId ? "Member ID already exists" : undefined)}>
          <Input value={form.memberId} onChange={(e) => setField("memberId", e.target.value)} />
        </Field>
        <Field id="gm-order" label="Order Id *" error={fieldErrors.orderId || (duplicateHints.orderId ? "Order ID already exists" : undefined)}>
          <Input value={form.orderId} onChange={(e) => setField("orderId", e.target.value)} />
        </Field>
        <Field id="gm-pkg" label="Package *" error={fieldErrors.packageId}>
          <Select value={form.packageId} onChange={(e) => setField("packageId", e.target.value)}>
            <option value="">Choose…</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (${p.orderDollar ?? p.priceUsd})
              </option>
            ))}
          </Select>
        </Field>
        <Field id="gm-pkr" label="PKR Amount *" error={fieldErrors.pkrAmount}>
          <Input type="number" value={form.pkrAmount} onChange={(e) => setField("pkrAmount", e.target.value)} />
        </Field>
        <Field id="gm-ab" label="Alibaba Discount ($)">
          <Input type="number" value={form.alibabaDiscount} onChange={(e) => setField("alibabaDiscount", e.target.value)} />
        </Field>
        <Field id="gm-rate" label="Dollar Rate *" error={fieldErrors.dollarRate}>
          <Input type="number" value={form.dollarRate} onChange={(e) => setField("dollarRate", e.target.value)} />
        </Field>
        <Field id="gm-order-dollar" label="Order Dollar (auto)">
          <Input readOnly className="bg-blue-50 font-semibold dark:bg-blue-950/30" value={numericValues.finalOrderDollar.toFixed(2)} />
        </Field>
        <Field id="gm-pkg-price" label="Package Price (auto)">
          <Input readOnly value={numericValues.packagePrice ? numericValues.packagePrice.toFixed(2) : ""} />
        </Field>
        <Field id="gm-extra-usd" label="Extra $ Discount (auto)">
          <Input readOnly value={numericValues.extraDollarDiscount.toFixed(2)} />
        </Field>
        <Field id="gm-extra-pct" label="Extra Discount % (auto)">
          <Input readOnly value={`${numericValues.extraDiscountPercentage.toFixed(2)}%`} />
        </Field>
        <Field id="gm-extra-pkr" label="Extra Discount PKR (auto)">
          <Input readOnly className="font-semibold text-emerald-700" value={Math.round(numericValues.extraDiscountPkr).toLocaleString()} />
        </Field>
        <Field id="gm-customer-usd" label="Customer $ (auto)">
          <Input readOnly value={numericValues.customerDollar.toFixed(2)} />
        </Field>
        <Field id="gm-pay" label="Payment Status *" error={fieldErrors.paymentStatus}>
          <Select value={form.paymentStatus} onChange={(e) => setField("paymentStatus", e.target.value)}>
            <option value="">Choose…</option>
            {GM_PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        {showPaymentUpload ? (
          <Field id="gm-proof" label="Payment screenshot *" error={paymentProofError}>
            <Input
              type="file"
              accept="image/*,.pdf"
              className="text-sm"
              onChange={(e) => onPaymentProofChange(e.target.files?.[0] ?? null)}
            />
            {paymentProof ? <p className="mt-1 truncate text-xs text-zinc-500">{paymentProof.name}</p> : null}
          </Field>
        ) : null}
        <Field id="gm-type" label="Type *" error={fieldErrors.type}>
          <Select value={form.type} onChange={(e) => setField("type", e.target.value)}>
            {GM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="gm-dropout" label="Dropout">
          <Select value={form.dropout} onChange={(e) => setField("dropout", e.target.value)}>
            <option value="">Choose…</option>
            {GM_DROPOUT_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="gm-extension" label="Extension">
          <Select value={form.extension} onChange={(e) => setField("extension", e.target.value)}>
            <option value="">Choose…</option>
            {GM_EXTENSION_OPTIONS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="gm-detail" label="Detail" className="md:col-span-2">
          <Input value={form.detail} onChange={(e) => setField("detail", e.target.value)} placeholder="Optional notes" />
        </Field>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Payment Type</p>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["none", "Full GM"],
              ["installment", "Partial GM"],
              ["loan", "Loan GM"],
            ] as const
          ).map(([mode, label]) => (
            <label key={mode} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="loanMode"
                checked={form.loanMode === mode}
                onChange={() => setField("loanMode", mode)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {form.loanMode !== "none" ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
          <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm">
            <span>
              Total order $: <strong>{numericValues.finalOrderDollar.toFixed(2)}</strong>
            </span>
            <span className={remaining < 0 ? "text-red-600" : remaining === 0 ? "text-emerald-600" : "text-amber-600"}>
              Remaining: ${remaining.toFixed(2)}
            </span>
          </div>
          {loanRows.map((row, index) => (
            <div key={index} className="mb-3 grid grid-cols-1 gap-2 border-b border-zinc-200 pb-3 last:border-0 md:grid-cols-4 dark:border-zinc-700">
              <Input
                type="number"
                placeholder="Dollar $"
                value={row.dollar}
                onChange={(e) => {
                  const val = e.target.value;
                  setLoanRows((prev) => {
                    const copy = [...prev];
                    const pkr =
                      val && numericValues.dollarRateNum > 0
                        ? (Number(val) * numericValues.dollarRateNum).toFixed(0)
                        : copy[index].pkrAmount;
                    copy[index] = { ...copy[index], dollar: val, pkrAmount: pkr };
                    return copy;
                  });
                }}
              />
              <Input
                type="number"
                placeholder="PKR"
                value={row.pkrAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  setLoanRows((prev) => {
                    const copy = [...prev];
                    copy[index] = { ...copy[index], pkrAmount: val };
                    return copy;
                  });
                }}
              />
              <Input
                placeholder="Cheque No *"
                value={row.chequeNo}
                onChange={(e) => {
                  const val = e.target.value;
                  setLoanRows((prev) => {
                    const copy = [...prev];
                    copy[index] = { ...copy[index], chequeNo: val };
                    return copy;
                  });
                }}
              />
              <Input
                type="date"
                value={row.payDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setLoanRows((prev) => {
                    const copy = [...prev];
                    copy[index] = { ...copy[index], payDate: val };
                    return copy;
                  });
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setLoanRows((prev) => [...prev, { ...EMPTY_GM_LOAN_ROW }])}
          >
            Add installment row
          </Button>
        </div>
      ) : null}

      {fieldErrors.general ? <p className="text-sm text-red-600">{fieldErrors.general}</p> : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={submitting || duplicateHints.companyBlock} onClick={onSubmit}>
          {submitting ? "Submitting…" : editRowId ? "Update / Resubmit" : "Submit form"}
        </Button>
      </div>
    </div>
  );
}
