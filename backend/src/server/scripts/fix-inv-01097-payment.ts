// Corrected one-off data fix: the first attempt stored the 30,000 PKR
// payment as a converted USD amount (107.14), which round-trips back to
// 29,999 PKR due to the amount column's 2-decimal-place limit. Delete that
// entry and re-insert it in its real currency (PKR, exact 30,000) — matches
// how the now-fixed approve endpoint records it going forward.
import { db } from "../db";
import { invoices, ledgerEntries } from "../../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const inv = await db.query.invoices.findFirst({ where: eq(invoices.invoiceNumber, "INV-01097") });
  if (!inv) {
    console.error("INV-01097 not found");
    process.exit(1);
  }

  const existing = await db.select().from(ledgerEntries).where(eq(ledgerEntries.referenceId, inv.id));
  for (const row of existing) {
    console.log("Deleting previous (incorrect) entry:", row.id, row.amount, row.currency);
    await db.delete(ledgerEntries).where(eq(ledgerEntries.id, row.id));
  }

  const [created] = await db.insert(ledgerEntries).values({
    entryType: "Credit",
    amount: "30000.00",
    currency: "PKR",
    description: `Payment recorded retroactively for invoice ${inv.invoiceNumber} (data correction — 30,000 PKR partial payment missed by the pre-fix approval flow)`,
    category: "Invoice Payment",
    referenceId: inv.id,
    referenceType: "Invoice",
    entryDate: new Date(),
    createdByUserId: inv.createdByUserId,
    status: "Posted",
    remarks: inv.paymentMethod || null,
  }).returning();

  console.log("Inserted correction ledger entry:", created.id, created.amount, created.currency);
  const rate = Number(inv.dollarRate) || 280;
  const dueUsd = Number(inv.total) - 30000 / rate;
  console.log(`Invoice total: ${inv.total} ${inv.currency} | Paid: 30000 PKR | Due: ${dueUsd.toFixed(2)} ${inv.currency} (~Rs ${Math.round(dueUsd * rate)})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
