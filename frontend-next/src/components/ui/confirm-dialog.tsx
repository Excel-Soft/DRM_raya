"use client";

import { useEffect, useRef } from "react";
import { Button } from "./button";
import { focusRing } from "@/styles/tokens";
import { cn } from "@/lib/utils/cn";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={cn(
        "max-w-md rounded-2xl border border-zinc-200 bg-white p-0 shadow-xl backdrop:bg-black/40 dark:border-zinc-700 dark:bg-zinc-900",
        focusRing,
      )}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <form method="dialog" className="p-5" onSubmit={(e) => e.preventDefault()}>
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "danger" : "primary"}
            disabled={pending}
            aria-busy={pending}
            onClick={onConfirm}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
