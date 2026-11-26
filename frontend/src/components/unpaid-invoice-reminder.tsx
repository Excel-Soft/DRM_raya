// Unpaid-invoice reminder toasts (old DRM: "Your payment is overdue. Please clear it soon …").
// Shows the logged-in user's invoices that accounts has not received payment for yet
// (GET /api/me/unpaid-invoices). Shown on every page load; the toasts close one by one,
// the bottom one every 5 seconds.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";
import { apiRequestJson } from "@/lib/queryClient";

type UnpaidInvoice = { key: string; invoiceId: string; company: string; amount: string; hod: string };

const AUTO_CLOSE_MS = 5000;
const MAX_TOASTS = 5;

export function UnpaidInvoiceReminder() {
  const [toasts, setToasts] = useState<UnpaidInvoice[]>([]);
  const [more, setMore] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiRequestJson<{ total: number; items: UnpaidInvoice[] }>("GET", "/api/me/unpaid-invoices")
      .then((d) => {
        if (cancelled || !d?.items?.length) return;
        setToasts(d.items.slice(0, MAX_TOASTS));
        setMore(Math.max(0, (d.total || 0) - Math.min(d.items.length, MAX_TOASTS)));
      })
      .catch(() => { /* reminder is best effort; never block the app */ });
    return () => { cancelled = true; };
  }, []);

  // one by one: every 5 s the bottom toast closes (4th, then 3rd, …); "+N more" goes with the last
  useEffect(() => {
    if (toasts.length === 0) {
      if (more > 0) setMore(0);
      return;
    }
    const timer = setTimeout(() => setToasts((cur) => cur.slice(0, -1)), AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [toasts, more]);

  if (toasts.length === 0 && more === 0) return null;

  return createPortal(
    <div className="fixed right-4 top-20 z-[9998] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
      {toasts.length > 1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { setToasts([]); setMore(0); }}
            className="rounded bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow hover:bg-red-600"
          >
            Close All
          </button>
        </div>
      )}
      {toasts.map((t) => (
        <div key={t.key} className="rounded-md border border-gray-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[13px] font-bold uppercase text-gray-900 dark:text-zinc-100">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
              <span className="truncate">{t.company}</span>
            </p>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setToasts((cur) => cur.filter((x) => x.key !== t.key))}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-[12px] text-gray-600 dark:text-zinc-400">Your payment is overdue. Please clear it soon. Thank you!</p>
          <p className="mt-1 text-[12px] text-gray-700 dark:text-zinc-300">
            Invoice #{t.invoiceId} · Hod: <span className="font-semibold text-emerald-700">{t.hod}</span>{" "}
            Account: <span className="font-semibold text-emerald-700">Not Pay</span>
          </p>
        </div>
      ))}
      {more > 0 && (
        <div className="rounded-md bg-gray-800 px-3 py-2 text-[12px] text-white shadow">
          +{more} more unpaid invoice{more === 1 ? "" : "s"}
        </div>
      )}
    </div>,
    document.body,
  );
}
