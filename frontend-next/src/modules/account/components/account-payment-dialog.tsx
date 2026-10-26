"use client";

import { DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/legacy/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/legacy/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";
import { AccountPrimaryButton, drmFieldClass } from "@/modules/account/account-ui";
import type { UseFormReturn } from "react-hook-form";

const paymentDialogClass =
  "flex max-h-[90vh] w-full max-w-md flex-col gap-0 overflow-hidden border-zinc-200 bg-zinc-50 p-0 dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl";

type InvoiceOption = { id: string; label: string };

export function AccountPaymentDialog({
  open,
  onOpenChange,
  form,
  invoices,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<any>;
  invoices: InvoiceOption[];
  onSubmit: (values: any) => void;
  pending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={paymentDialogClass}>
        <DialogHeader className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Account · Payment
          </p>
          <DialogTitle className="flex items-center gap-2 text-left text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            <DollarSign className="h-5 w-5 text-emerald-600" />
            Make payment
          </DialogTitle>
          <DialogDescription className="text-left text-sm text-zinc-600 dark:text-zinc-400">
            Record a payment against an open invoice.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-4">
          <Form {...form}>
            <form id="account-payment-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="invoiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Invoice</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={cn(drmFieldClass, "h-10")}>
                          <SelectValue placeholder="Select invoice" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {invoices.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {inv.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      Amount to pay
                    </FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} className={cn(drmFieldClass, "h-10")} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      Payment method
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={cn(drmFieldClass, "h-10")}>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="BankTransfer">Bank transfer</SelectItem>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      Notes (optional)
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Payment details…"
                        {...field}
                        className={cn(drmFieldClass, "min-h-[72px] resize-none text-sm")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>

        <DialogFooter className="gap-2 border-t border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <AccountPrimaryButton type="submit" form="account-payment-form" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm payment
          </AccountPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
