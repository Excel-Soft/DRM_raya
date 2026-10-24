"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { apiFetch } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils/cn";

type Row = {
  id: string;
  drmId?: string;
  company: string;
  country?: string;
  holder: string;
  salePerson: string;
  email: string;
  mobile: string;
  lastFollow: string;
};

function parseEmailOrPhone(value: string): { email?: string; phone?: string } {
  const v = value.trim();
  if (!v) return {};
  if (v.includes("@")) return { email: v };
  return { phone: v };
}

export function DuplicateCheckerView() {
  const searchParams = useSearchParams();
  const [companyQuery, setCompanyQuery] = useState(() => searchParams.get("company") ?? "");
  const [emailQuery, setEmailQuery] = useState(() => searchParams.get("email") ?? "");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [apiRows, setApiRows] = useState<Row[] | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const debounceTimer = useRef<number | null>(null);
  const normalizedCompany = companyQuery.trim();
  const normalizedEmail = emailQuery.trim();
  const hasSearch = normalizedCompany.length > 0 || normalizedEmail.length > 0;
  const visibleRows = apiRows ?? [];

  const allVisibleSelected =
    visibleRows.length > 0 && visibleRows.every((r) => selectedRowIds.has(r.id));
  const someVisibleSelected =
    visibleRows.length > 0 && visibleRows.some((r) => selectedRowIds.has(r.id));

  useEffect(() => {
    const visibleIds = new Set(visibleRows.map((r) => r.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prune selection when result set changes
    setSelectedRowIds((prev) => {
      const next = new Set<string>();
      let changed = false;
      prev.forEach((id) => {
        if (visibleIds.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [visibleRows]);

  useEffect(() => {
    if (!hasSearch) return;

    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);

    debounceTimer.current = window.setTimeout(async () => {
      const params = new URLSearchParams();
      if (companyQuery.trim()) params.set("company", companyQuery.trim());
      const { email, phone } = parseEmailOrPhone(emailQuery);
      if (email) params.set("email", email);
      if (phone) params.set("phone", phone);
      if (!params.toString()) return;

      setIsLoading(true);
      setApiError(null);
      try {
        const body = await apiFetch<{
          duplicates?: Array<{
            id: string;
            drmId: string | null;
            companyName: string;
            country: string | null;
            accountName: string;
            salesPersonName: string | null;
            email: string;
            phone: string;
            lastFollowDate: string | null;
          }>;
        }>(`/api/check-duplicate?${params.toString()}`);

        const rows: Row[] = (body.duplicates ?? []).map((d) => ({
          id: d.id,
          drmId: d.drmId ?? undefined,
          company: d.companyName,
          country: d.country ?? "",
          holder: d.accountName,
          salePerson: d.salesPersonName ?? "-",
          email: d.email,
          mobile: d.phone,
          lastFollow: d.lastFollowDate ? d.lastFollowDate.slice(0, 10) : "-",
        }));
        setApiRows(rows);
      } catch (e) {
        setApiRows(null);
        if (e instanceof ApiError && e.status === 401) {
          setApiError("Unauthorized. Please login again.");
        } else {
          setApiError(e instanceof ApiError ? e.message : "Failed to load results.");
        }
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [companyQuery, emailQuery, hasSearch]);

  const onToggleAllVisible = () => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of visibleRows) next.delete(r.id);
      } else {
        for (const r of visibleRows) next.add(r.id);
      }
      return next;
    });
  };

  const onToggleRow = (id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <PageHeader
        eyebrow="Customer"
        title="Check Duplication"
        description="Search by company name or email/mobile to find existing customer records."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Field id="companyName" label="Company Name">
          <Input
            id="companyName"
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
            placeholder="Enter company name or id"
          />
        </Field>
        <Field id="email" label="Email / mobile">
          <Input
            id="email"
            value={emailQuery}
            onChange={(e) => setEmailQuery(e.target.value)}
            placeholder="Enter e-mail or mobile no"
          />
        </Field>
      </div>

      {apiError ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
          {apiError}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-800/80">
              <th className="w-12 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allVisibleSelected && someVisibleSelected;
                  }}
                  onChange={onToggleAllVisible}
                  className="h-4 w-4 rounded border-zinc-300"
                />
              </th>
              <th className="px-3 py-3 font-semibold text-zinc-700 dark:text-zinc-200">ID</th>
              <th className="px-3 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Company</th>
              <th className="px-3 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Holder</th>
              <th className="px-3 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Sale Person</th>
              <th className="px-3 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Email</th>
              <th className="px-3 py-3 font-semibold text-zinc-700 dark:text-zinc-200">Last Follow</th>
            </tr>
          </thead>
          <tbody>
            {hasSearch && visibleRows.length > 0 ? (
              visibleRows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select row ${r.id}`}
                      checked={selectedRowIds.has(r.id)}
                      onChange={() => onToggleRow(r.id)}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                  </td>
                  <td className="px-3 py-3 font-medium text-zinc-800 dark:text-zinc-200">{r.drmId || "—"}</td>
                  <td className={cn("px-3 py-3 uppercase text-zinc-600 dark:text-zinc-400")}>{r.company}</td>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{r.holder}</td>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{r.salePerson}</td>
                  <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{r.email}</td>
                  <td className="px-3 py-3 text-center text-zinc-600 dark:text-zinc-400">{r.lastFollow}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                  {isLoading ? "Searching…" : hasSearch ? "No matching records found." : "Search to check for duplications."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
