"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { apiRequest, mutationRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { OfficeAccountShell } from "@/modules/office-account/office-account-ui";

interface ChequeRow {
  id: string;
  companyName: string | null;
  amount: string | null;
  chequeNumber: string | null;
  chequeDate: string;
  chequeType: string | null;
  bankName: string | null;
  notes: string | null;
  status: string | null;
  usedAmount: number;
  remainingAmount: string;
}

function numberToWords(num: number): string {
  if (!num || isNaN(num) || num === 0) return "";
  const a = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  const convert = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " hundred" + (n % 100 !== 0 ? " " + convert(n % 100) : "");
    if (n < 1000000) return convert(Math.floor(n / 1000)) + " thousand" + (n % 1000 !== 0 ? " " + convert(n % 1000) : "");
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + " million" + (n % 1000000 !== 0 ? " " + convert(n % 1000000) : "");
    return "";
  };
  return convert(num);
}

const EMPTY_FORM = {
  companyName: "",
  amount: "",
  chequeDate: "",
  notes: "",
  chequeType: "",
};

export function ChequeSystemPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [chequeDigits, setChequeDigits] = useState<string[]>(Array(8).fill(""));
  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);

  const { data: cheques = [], isLoading } = useQuery<ChequeRow[]>({
    queryKey: ["/api/office/cheques"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/office/cheques");
      if (!res.ok) throw new Error("Failed to load cheques");
      return res.json();
    },
  });

  function handleDigitChange(index: number, value: string) {
    const next = [...chequeDigits];
    next[index] = value.slice(-1);
    setChequeDigits(next);
    if (value && index < 7) {
      const nextInput = document.getElementById(`cheque-digit-${index + 1}`);
      if (nextInput) (nextInput as HTMLInputElement).focus();
    }
  }

  async function handleSubmit() {
    const chequeNumber = chequeDigits.join("");
    if (!chequeNumber || !formData.amount || !formData.companyName || !formData.chequeDate) {
      toast({ title: "Error", description: "Please fill required fields", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await mutationRequest("POST", "/api/office/cheques", {
        ...formData,
        chequeNumber,
        bankName: "Askari Bank",
        currency: "PKR",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/office/cheques"] });
      setFormData({ ...EMPTY_FORM });
      setChequeDigits(Array(8).fill(""));
      toast({ title: "Success", description: "Cheque added successfully" });
    } catch {
      toast({ title: "Error", description: "Failed to add cheque", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const unusedPkr = cheques
    .filter((c) => c.status === "Pending")
    .reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0)
    .toLocaleString("en-US", { minimumFractionDigits: 2 });

  const usedPkr = cheques
    .filter((c) => c.status !== "Pending")
    .reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0)
    .toLocaleString("en-US", { minimumFractionDigits: 2 });

  return (
    <OfficeAccountShell title="Cheque System">
      <div className="mb-2 text-sm font-bold tracking-wide">
        <span className="text-zinc-600 dark:text-zinc-300">CREATE CHEQUE UN-USED PKR: </span>
        <span className="text-red-500">{unusedPkr}</span>
        <span className="ml-4 text-zinc-600 dark:text-zinc-300">CHEQUE USED PKR: </span>
        <span className="text-emerald-500">{usedPkr}</span>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Left Panel: Form */}
        <div className="w-full flex-shrink-0 lg:w-[400px]">
          <div className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-5 text-base font-semibold text-zinc-700 dark:text-zinc-200">Askari Bank Cheque</h2>

            <div className="space-y-4">
              <Field id="chq-payee" label="Payee Name:">
                <Input id="chq-payee" value={formData.companyName} onChange={(e) => setFormData((f) => ({ ...f, companyName: e.target.value }))} />
              </Field>

              <Field id="chq-amount" label="Amount:">
                <Input id="chq-amount" type="number" value={formData.amount} onChange={(e) => setFormData((f) => ({ ...f, amount: e.target.value }))} />
              </Field>

              <Field id="chq-digit-0" label="Cheque Number:">
                <div className="flex justify-between gap-1">
                  {chequeDigits.map((digit, i) => (
                    <Input
                      key={i}
                      id={`cheque-digit-${i}`}
                      value={digit}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      maxLength={1}
                      className="h-10 w-full p-0 text-center text-lg font-medium"
                    />
                  ))}
                </div>
              </Field>

              <Field id="chq-date" label="Cheque Date:">
                <Input id="chq-date" type="date" value={formData.chequeDate} onChange={(e) => setFormData((f) => ({ ...f, chequeDate: e.target.value }))} />
              </Field>

              <Field id="chq-type" label="Type">
                <Select value={formData.chequeType} onValueChange={(v) => setFormData((f) => ({ ...f, chequeType: v }))}>
                  <SelectTrigger id="chq-type">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="For Dollar">For Dollar</SelectItem>
                    <SelectItem value="For Expense">For Expense</SelectItem>
                    <SelectItem value="Recovery">Recovery</SelectItem>
                    <SelectItem value="Last Closing">Last Closing</SelectItem>
                    <SelectItem value="Direct Purchase">Direct Purchase</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field id="chq-notes" label="Comments:">
                <Textarea
                  id="chq-notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Enter comment"
                  className="h-20 resize-none"
                />
              </Field>

              <Button onClick={handleSubmit} disabled={submitting} className="mt-2 w-full">
                {submitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Panel: Cheque List */}
        <div className="flex flex-1 flex-col gap-6">
          {isLoading ? (
            <div className="p-8 text-center text-zinc-500">Loading cheques...</div>
          ) : cheques.length === 0 ? (
            <div className="rounded-md border border-zinc-200 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              No cheques generated yet.
            </div>
          ) : (
            cheques.map((cheque) => (
              <div
                key={cheque.id}
                className="relative flex w-full max-w-[850px] flex-col overflow-hidden border border-zinc-300 bg-white shadow-sm dark:bg-zinc-900"
                style={{ minHeight: "320px" }}
              >
                <div className="pointer-events-none absolute left-0 top-0 z-10 h-28 w-28 overflow-hidden">
                  <div className="absolute -left-12 top-6 w-52 -rotate-45 border-y border-blue-200 bg-[#d0eaf9] py-1 text-center text-[10px] font-extrabold uppercase tracking-wider text-[#0f5c9c] shadow-sm">
                    {cheque.chequeType || "FOR DOLLAR"}
                  </div>
                </div>

                <div className="relative z-0 flex-1 p-6 pb-2">
                  <div className="mb-6 flex items-start justify-between pl-14">
                    <div className="flex items-center">
                      <div className="flex flex-col">
                        <div className="flex items-baseline">
                          <span className="text-[28px] font-bold leading-none tracking-tight text-[#005a9c]">askari</span>
                          <span className="text-[28px] font-normal leading-none tracking-tight text-zinc-500">bank</span>
                        </div>
                        <span className="mt-0.5 self-end mr-1 text-[8px] font-bold uppercase leading-none tracking-widest text-zinc-400">Limited</span>
                      </div>
                      <div className="relative ml-2 flex h-6 w-6 rotate-45 items-center justify-center overflow-hidden bg-[#005a9c]">
                        <div className="absolute -left-1 -top-1 h-3 w-3 rotate-45 border border-white" />
                        <div className="absolute -bottom-1 -right-1 h-3 w-3 rotate-45 border border-white" />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-right text-sm font-bold leading-tight text-zinc-400">
                        Cheque
                        <br />
                        No
                      </span>
                      <div className="flex gap-0.5 bg-[#d0eaf9] p-1.5">
                        {(cheque.chequeNumber || "").padEnd(8, "0").split("").map((digit, i) => (
                          <div key={i} className="w-[18px] text-center font-mono text-[17px] font-semibold text-zinc-800">
                            {digit}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 mb-2 flex items-end justify-between">
                    <div className="text-[13px] font-medium uppercase leading-[1.3] text-zinc-700">
                      <strong>ASKARI BANK LIMITED</strong>
                      <br />
                      IBB DHA KARACHI JAMI COMMERCIAL PHASE VII DHA KHI
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-zinc-400">Date</span>
                      <div className="flex gap-0.5 bg-white dark:bg-zinc-900">
                        {format(new Date(cheque.chequeDate), "yyyyMMdd").split("").map((digit, i) => (
                          <div key={i} className="flex h-7 w-[18px] items-center justify-center border border-zinc-300 font-mono text-[16px] text-zinc-800">
                            {digit}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative z-0 flex flex-1 flex-col justify-between bg-[#d0eaf9] px-6 pb-4 pt-5">
                  <div>
                    <div className="mb-4 flex items-end">
                      <span className="w-16 text-sm font-bold text-zinc-400">Pay</span>
                      <div className="relative flex-1 border-b border-zinc-400 pb-0.5">
                        <span className="block truncate pl-2 pr-4 text-[15px] text-zinc-700">{cheque.companyName}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="mb-4 flex items-end">
                          <span className="w-16 text-sm font-bold text-zinc-400">Rupess</span>
                          <div className="flex-1 border-b border-zinc-400 pb-0.5">
                            <span className="block truncate pl-2 text-[15px] capitalize text-zinc-700">
                              {numberToWords(parseFloat(cheque.amount || "0"))}
                            </span>
                          </div>
                        </div>
                        <div className="mb-4 flex items-end">
                          <span className="w-16 text-sm font-bold text-transparent">-</span>
                          <div className="flex-1 border-b border-zinc-400" />
                        </div>
                      </div>

                      <div className="mt-[-10px] flex h-[38px] w-[240px] items-center gap-2 border border-zinc-400 bg-transparent px-3">
                        <span className="text-sm font-bold text-zinc-400">PKR</span>
                        <span className="text-[17px] font-semibold text-zinc-800">{parseFloat(cheque.amount || "0").toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-end justify-between">
                    <span className="text-[13px] font-bold text-zinc-400">Please do not write bellow this line</span>
                    <div className="relative w-56 pt-1 text-center">
                      <span className="absolute -top-3.5 left-0 right-0 text-[11px] text-zinc-600">
                        {cheque.status === "Pending" ? "not used" : "used"}
                      </span>
                      <div className="border-t border-zinc-400" />
                      <span className="mt-0.5 block text-[13px] text-zinc-400">Signature</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </OfficeAccountShell>
  );
}
