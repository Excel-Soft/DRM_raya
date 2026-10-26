import type { InvoiceReceiptData } from "@/modules/sales/invoice-receipt";
import { WEBEXCELS_FROM } from "@/modules/sales/invoice-receipt";

type GmLike = {
  id?: string;
  companyName?: string;
  memberId?: string | null;
  entryType?: string | null;
  packageType?: string | null;
  notes?: string | null;
  amountUsd?: string | null;
  amountPkr?: string | null;
  createdAt?: Date | string | null;
};

/** Build printable invoice/quotation slip data from a GM entry (account invoice queue). */
export function gmEntryToReceiptData(entry: GmLike, kind: "invoice" | "quotation" = "invoice"): InvoiceReceiptData {
  const usd = Number(entry.amountUsd || 0);
  const pkr = Number(entry.amountPkr || 0) || usd * 277;
  const detail =
    entry.notes ||
    [entry.packageType, entry.entryType].filter(Boolean).join(" • ") ||
    (kind === "quotation" ? "Quotation line" : "Business listing fee");

  return {
    invoiceNumber: entry.id?.slice(0, 8) || "7680",
    date: entry.createdAt ? new Date(entry.createdAt) : new Date(),
    from: { ...WEBEXCELS_FROM },
    to: {
      name: entry.companyName || "Customer",
      phone: entry.memberId || "—",
      email: "—",
      address: "—",
    },
    items: [
      {
        name: entry.entryType || entry.packageType || "Service",
        detail,
        price: usd,
        quantity: 1,
        total: usd,
      },
    ],
    subTotalUsd: usd,
    subTotalPkr: pkr,
    taxUsd: 0,
    discountPkr: 0,
    totalPkr: pkr,
  };
}
