"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useApiResource } from "@/lib/hooks/use-api-resource";

const TABS = [
  "Contact History",
  "Company History",
  "Quotation History",
  "Invoice History",
  "GM History",
] as const;

type Tab = (typeof TABS)[number];

type Props = {
  customerId: string;
  onEditContact?: () => void;
};

function formatDate(val: unknown) {
  if (!val) return "—";
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? String(val) : d.toLocaleString();
}

export function CustomerAttributeHistory({ customerId, onEditContact }: Props) {
  const [tab, setTab] = useState<Tab>("Contact History");

  const followupsPath = customerId ? `/api/sales/customers/${customerId}/followups` : null;
  const { data: followups, loading: contactLoading } = useApiResource<unknown[]>(followupsPath);

  const companyPath = tab === "Company History" && customerId ? `/api/sales/leads/${customerId}/history?type=company` : null;
  const { data: companyHistory, loading: companyLoading } = useApiResource<unknown[]>(companyPath);

  const quotePath = tab === "Quotation History" && customerId ? `/api/quotations?leadId=${customerId}` : null;
  const { data: quoteRes, loading: quoteLoading } = useApiResource<{ data?: unknown[] } | unknown[]>(quotePath);

  const invoicePath = tab === "Invoice History" && customerId ? `/api/sales/customers/${customerId}/invoices` : null;
  const { data: invoices, loading: invoiceLoading } = useApiResource<unknown[]>(invoicePath);

  const gmPath = tab === "GM History" && customerId ? `/api/sales/customers/${customerId}/gm-entries` : null;
  const { data: gmEntries, loading: gmLoading } = useApiResource<unknown[]>(gmPath);

  const contactRows = useMemo(() => (Array.isArray(followups) ? followups : []), [followups]);
  const companyRows = useMemo(() => (Array.isArray(companyHistory) ? companyHistory : []), [companyHistory]);
  const quoteRows = useMemo(() => {
    if (Array.isArray(quoteRes)) return quoteRes;
    if (quoteRes && typeof quoteRes === "object" && Array.isArray((quoteRes as { data?: unknown[] }).data)) {
      return (quoteRes as { data: unknown[] }).data;
    }
    return [];
  }, [quoteRes]);
  const invoiceRows = useMemo(() => (Array.isArray(invoices) ? invoices : []), [invoices]);
  const gmRows = useMemo(() => (Array.isArray(gmEntries) ? gmEntries : []), [gmEntries]);

  const loading =
    (tab === "Contact History" && contactLoading) ||
    (tab === "Company History" && companyLoading) ||
    (tab === "Quotation History" && quoteLoading) ||
    (tab === "Invoice History" && invoiceLoading) ||
    (tab === "GM History" && gmLoading);

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-2 dark:border-zinc-800">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-bold transition ${
                tab === t
                  ? "border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-4">
          <TableSkeleton rows={5} columns={3} />
        </div>
      ) : tab === "Contact History" ? (
        <HistoryTable
          empty="No contact history recorded."
          columns={["Date", "Note", "Action"]}
          rows={contactRows.map((row, idx) => {
            const r = row as Record<string, unknown>;
            return [
              formatDate(r.createdAt ?? r.created_at),
              String(r.note ?? r.notes ?? r.serviceType ?? r.method ?? "—"),
              onEditContact ? (
                <Button key="edit" type="button" size="sm" variant="secondary" onClick={onEditContact}>
                  Edit
                </Button>
              ) : (
                "—"
              ),
            ];
          })}
        />
      ) : tab === "Company History" ? (
        <HistoryTable
          empty="No company history recorded."
          columns={["Title", "Detail", "Date"]}
          rows={companyRows.map((row) => {
            const r = row as Record<string, unknown>;
            return [String(r.action ?? r.title ?? "—"), String(r.meta ?? r.detail ?? "—"), formatDate(r.createdAt ?? r.created_at)];
          })}
        />
      ) : tab === "Quotation History" ? (
        <HistoryTable
          empty="No quotations recorded."
          columns={["Date", "Grand total", "Status"]}
          rows={quoteRows.map((row) => {
            const r = row as Record<string, unknown>;
            return [formatDate(r.createdAt ?? r.created_at), String(r.grandTotal ?? r.total ?? "—"), String(r.status ?? "—")];
          })}
        />
      ) : tab === "Invoice History" ? (
        <HistoryTable
          empty="No invoices recorded."
          columns={["Date", "Amount", "Status"]}
          rows={invoiceRows.map((row) => {
            const r = row as Record<string, unknown>;
            return [formatDate(r.createdAt ?? r.created_at), String(r.amount ?? r.total ?? "—"), String(r.status ?? "—")];
          })}
        />
      ) : (
        <HistoryTable
          empty="No GM entries recorded."
          columns={["Package", "Status", "Created"]}
          rows={gmRows.map((row) => {
            const r = row as Record<string, unknown>;
            return [String(r.package ?? r.packageType ?? "—"), String(r.status ?? r.paymentStatus ?? "—"), formatDate(r.createdAt ?? r.created_at)];
          })}
        />
      )}
    </div>
  );
}

function HistoryTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: unknown[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs font-semibold uppercase text-zinc-600 dark:bg-zinc-900/80 dark:text-zinc-400">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-4 py-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, idx) => (
            <tr key={idx} className="border-t border-zinc-100 dark:border-zinc-800">
              {cells.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 align-top">
                  {cell as ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
