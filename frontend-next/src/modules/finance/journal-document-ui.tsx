"use client";

import type { ReactNode } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils/cn";
import { drmFieldClass } from "@/modules/drm/drm-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type JournalDocumentKind = "invoice" | "quotation";

export const journalFieldLabelClass =
  "text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

export const journalInputClass = cn(drmFieldClass, "h-10 text-sm");

export const journalReadonlyInputClass = cn(journalInputClass, "bg-zinc-50 dark:bg-zinc-800/80");

export function JournalDocumentShell({
  kind,
  timestamp = new Date(),
  subtitle,
  children,
  footer,
  className,
}: {
  kind: JournalDocumentKind;
  timestamp?: Date;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const title = kind === "quotation" ? "Quotation" : "Invoice";
  const eyebrow = kind === "quotation" ? "Sales · Quotation" : "Account · Invoice";

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col bg-white dark:bg-zinc-900", className)}>
      <header className="shrink-0 border-b border-zinc-200 bg-zinc-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950/50 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {title}{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            {format(timestamp, "dd-MM-yyyy hh:mm a")}
          </span>
        </h2>
        {subtitle ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p> : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

      {footer ? (
        <footer className="shrink-0 border-t border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900 sm:px-6">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}

export function JournalMetaGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5", className)}>{children}</div>
  );
}

export function JournalMetaField({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  type?: "text" | "number" | "email";
}) {
  return (
    <div className="space-y-1">
      <Label className={journalFieldLabelClass}>{label}</Label>
      <Input
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={readOnly ? journalReadonlyInputClass : journalInputClass}
      />
    </div>
  );
}

export function JournalLinesPanel({
  header,
  children,
  addAction,
}: {
  header: ReactNode;
  children: ReactNode;
  addAction?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60">
        {header}
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">{children}</div>
      {addAction ? <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">{addAction}</div> : null}
    </div>
  );
}

export function JournalLineHeaderRow({ columns }: { columns: { label: string; className?: string }[] }) {
  return (
    <div className="hidden grid-cols-12 gap-2 md:grid">
      {columns.map((col) => (
        <div key={col.label} className={cn("text-[10px] font-bold uppercase text-zinc-500 dark:text-zinc-400", col.className)}>
          {col.label}
        </div>
      ))}
    </div>
  );
}

export function JournalLineRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-12 md:items-center md:gap-2", className)}>
      {children}
    </div>
  );
}

export function JournalTotalsGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">{children}</div>;
}

export function JournalFormFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-2">{children}</div>;
}
