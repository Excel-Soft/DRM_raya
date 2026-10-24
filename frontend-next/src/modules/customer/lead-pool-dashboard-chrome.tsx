"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import {
  CUSTOMER_PRIVATE_POOL,
  CUSTOMER_PUBLIC_POOL,
  CUSTOMER_SERVICE_POOL,
} from "@/lib/navigation/customer-routes";
import { LEAD_GM_BV_POOL, LEAD_LEAD_POOL } from "@/lib/navigation/lead-routes";

export type LeadPoolSummaryResponse = {
  chips?: {
    yetToContact?: number;
    contacted?: number;
    invoiceSent?: number;
    whatsapp?: number;
    email?: number;
    sms?: number;
    instagram?: number;
  };
  pools?: {
    privatePool?: number;
    servicePool?: number;
    gmBvPool?: number;
    publicPool?: number;
    expiringSoon?: number;
  };
};

const STATUS_CHIPS = [
  { key: "yetToContact", label: "Yet to Contact", status: "New", gradient: "from-emerald-600 to-teal-700" },
  { key: "contacted", label: "Contact", status: "Contacted", gradient: "from-rose-500 to-pink-600" },
  { key: "invoiceSent", label: "Invoice Sent", status: "Invoice Sent", gradient: "from-teal-500 to-cyan-600" },
  { key: "whatsapp", label: "WhatsApp", status: "WhatsApp", gradient: "from-blue-500 to-indigo-600" },
  { key: "email", label: "Email", status: "Email", gradient: "from-orange-500 to-amber-600" },
  { key: "sms", label: "SMS", status: "SMS", gradient: "from-slate-500 to-slate-700" },
  { key: "instagram", label: "Instagram", status: "Instagram", gradient: "from-fuchsia-500 to-pink-600" },
] as const;

const POOL_CARDS = [
  { key: "private", label: "Private Pool", href: CUSTOMER_PRIVATE_POOL, countKey: "privatePool" as const, ring: "ring-emerald-500/40" },
  { key: "service", label: "Service Pool", href: CUSTOMER_SERVICE_POOL, countKey: "servicePool" as const, ring: "ring-purple-500/40" },
  { key: "gmbv", label: "GM BV Pool", href: LEAD_GM_BV_POOL, countKey: "gmBvPool" as const, ring: "ring-amber-500/40" },
  { key: "public", label: "Public Pool", href: CUSTOMER_PUBLIC_POOL, countKey: "publicPool" as const, ring: "ring-sky-500/40" },
] as const;

/** Lead sidebar hub card (same counts, lands on canonical lead pool). */
export const LEAD_POOL_HUB_CARD = {
  key: "lead",
  label: "Lead Pool",
  href: LEAD_LEAD_POOL,
  countKey: "privatePool" as const,
  ring: "ring-emerald-500/40",
} as const;

type Props = {
  summary: LeadPoolSummaryResponse | null;
  statusFilter: string | null;
  onStatusFilter: (status: string | null) => void;
  activePool: "private" | "public";
};

export function LeadPoolDashboardChrome({ summary, statusFilter, onStatusFilter, activePool }: Props) {
  const chips = summary?.chips ?? {};
  const pools = summary?.pools ?? {};

  return (
    <div className="mb-6 space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_CHIPS.map((item) => {
          const count = Number(chips[item.key as keyof typeof chips] ?? 0);
          const active = statusFilter === item.status;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onStatusFilter(active ? null : item.status)}
              className={cn(
                "min-w-[120px] flex-1 rounded-xl bg-gradient-to-br px-3 py-3 text-left text-white shadow-sm transition-transform",
                item.gradient,
                active ? "scale-[1.02] ring-2 ring-white/40" : "opacity-90 hover:opacity-100",
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-90">{item.label}</span>
              <p className="text-2xl font-black">{count}</p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        {POOL_CARDS.map((card) => {
          const isActive = (card.key === "private" && activePool === "private") || (card.key === "public" && activePool === "public");
          const count = pools[card.countKey] ?? 0;
          const inner = (
            <div
              className={cn(
                "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition dark:border-zinc-800 dark:bg-zinc-900",
                isActive && `ring-2 ${card.ring}`,
              )}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{card.label}</p>
              <p className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{count}</p>
            </div>
          );
          if (card.key === activePool) return <div key={card.key}>{inner}</div>;
          return (
            <Link key={card.key} href={card.href} className="block hover:opacity-95">
              {inner}
            </Link>
          );
        })}
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-[11px] font-bold uppercase tracking-wide text-red-700 dark:text-red-400">Expiring soon</p>
          <p className="text-2xl font-black text-red-800 dark:text-red-300">{pools.expiringSoon ?? 0}</p>
        </div>
      </div>
    </div>
  );
}
