import { db } from "./server/db";
import { invoices, productPostingInvoices, officeVas } from "@shared/schema";
import { gte, lte, and, inArray } from "drizzle-orm";
import fs from "fs";

async function testGetVas() {
  const fromDate = new Date("2026-03-31T00:00:00.000Z");
  const toDate = new Date("2026-05-20T23:59:59.999Z");
  const userIds = ["6d406b3c-4055-4c8c-b421-9367f187a672"]; // Haider

  try {
  // Fetch from office_vas instead of vas_progress_snapshots
  const vasConditions = [
    gte(officeVas.vasDate, fromDate),
    lte(officeVas.vasDate, toDate)
  ];
  if (userIds && userIds.length > 0) {
    vasConditions.push(inArray(officeVas.createdByUserId, userIds));
  }

  const vasEntries = await db
    .select()
    .from(officeVas)
    .where(and(...vasConditions));

  // Fetch approved invoices from productPostingInvoices
  const invoiceConditions = [
    gte(productPostingInvoices.updatedAt, fromDate),
    lte(productPostingInvoices.updatedAt, toDate),
    inArray(productPostingInvoices.status, ['PENDING_ACCOUNT', 'APPROVED']) // HOD approved
  ];
  if (userIds && userIds.length > 0) {
    invoiceConditions.push(inArray(productPostingInvoices.salesExecId, userIds));
  }

  const invoiceEntriesRaw = await db
    .select()
    .from(productPostingInvoices)
    .where(and(...invoiceConditions));

  // Fetch approved standard invoices
  const stdInvoiceConditions = [
    gte(invoices.updatedAt, fromDate),
    lte(invoices.updatedAt, toDate),
    inArray(invoices.status, ['Paid', 'APPROVED']) // Account approved
  ];
  if (userIds && userIds.length > 0) {
    stdInvoiceConditions.push(inArray(invoices.createdByUserId, userIds));
  }

  const stdInvoiceEntriesRaw = await db
    .select()
    .from(invoices)
    .where(and(...stdInvoiceConditions));

  // Combine them
  const combinedDetails = [
    ...vasEntries.map(v => ({
      id: v.id,
      companyName: v.companyName,
      amount: v.amount,
      method: v.method,
      date: v.vasDate,
      notes: v.notes,
      type: "VAS"
    })),
    ...invoiceEntriesRaw.map(i => ({
      id: i.id,
      companyName: i.companyName || i.projectName || 'Invoice',
      amount: i.amount,
      method: i.paymentMethod || "Invoice",
      date: i.updatedAt,
      notes: `Invoice Status: ${i.status}`,
      type: "Invoice"
    })),
    ...stdInvoiceEntriesRaw.map(i => ({
      id: i.id,
      companyName: i.customerName || 'Standard Invoice',
      amount: i.total,
      method: i.paymentMethod || "Standard Invoice",
      date: i.updatedAt,
      notes: `Invoice Status: ${i.status}`,
      type: "Invoice"
    }))
  ];

  // Sort by date descending
  combinedDetails.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

      
    console.log("SUCCESS!", combinedDetails);
  } catch (e) {
    console.error("ERROR:", e);
  }
  process.exit();
}
testGetVas();
