import { db } from "./server/db";
import { invoices, productPostingInvoices } from "@shared/schema";
import { gte, lte, and, inArray } from "drizzle-orm";

async function testGetVas() {
  const fromDate = new Date("2026-03-31T00:00:00.000Z");
  const toDate = new Date("2026-05-20T23:59:59.999Z");
  const userIds = ["6d406b3c-4055-4c8c-b421-9367f187a672"]; // Haider

  const stdInvoiceConditions = [
    gte(invoices.updatedAt, fromDate),
    lte(invoices.updatedAt, toDate),
    inArray(invoices.status, ['Paid', 'APPROVED'])
  ];
  if (userIds && userIds.length > 0) {
    stdInvoiceConditions.push(inArray(invoices.createdByUserId, userIds));
  }
  
  try {
    const stdInvoiceEntriesRaw = await db
      .select()
      .from(invoices)
      .where(and(...stdInvoiceConditions));
      
    console.log("Haider Invoices:", stdInvoiceEntriesRaw.length, stdInvoiceEntriesRaw.map(i => ({ id: i.invoiceNumber, method: i.paymentMethod })));
  } catch (e) {
    console.error("ERROR:", e);
  }
  process.exit();
}
testGetVas();
