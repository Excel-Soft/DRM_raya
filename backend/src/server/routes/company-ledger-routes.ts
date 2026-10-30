import { Router } from "express";
import { db } from "../db";
import { ledgerEntries, invoices, customers, users } from "../../shared/schema";
import { eq, desc, sql, and, ilike, or, gte, lte, inArray } from "drizzle-orm";
import { requireFinancialPermission, FINANCIAL_ACTIONS, FINANCIAL_VIEW_ROLES, FINANCIAL_VOID_ROLES } from "./middleware/financial-permission";

export const companyLedgerRouter = Router();

// GET /api/reports/ledger (Company Ledger Summary)
companyLedgerRouter.get("/api/reports/ledger", requireFinancialPermission(FINANCIAL_ACTIONS.accountLedgerView, { roles: FINANCIAL_VIEW_ROLES }), async (req, res) => {
  try {
    const { company, contact, ntn, from, page = "1", pageSize = "15" } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limit = parseInt(pageSize as string, 10);
    const offset = (pageNum - 1) * limit;

    // Fetch invoices grouped by company
    // In PostgreSQL we would use GROUP BY, but let's just fetch all and group them or use Drizzle grouped query
    
    let conditions = [];
    if (company) {
      conditions.push(ilike(invoices.customerName, `%${company}%`));
    }
    if (from) {
      conditions.push(gte(invoices.createdAt, new Date(from as string)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allInvoices = await db.query.invoices.findMany({
      where: whereClause,
      orderBy: [desc(invoices.createdAt)]
    });

    const allCustomers = await db.select({
      companyName: customers.companyName,
      accountName: customers.accountName
    }).from(customers);

    const customerMap = new Map<string, string>();
    for (const c of allCustomers) {
      if (c.companyName) {
        customerMap.set(c.companyName.toLowerCase().trim(), c.accountName || "N/A");
      }
    }

    // Grouping by company name
    const companyTotals = new Map<string, { companyName: string, accountName: string, subTotal: number, discount: number, grandTotal: number, pay: number, due: number, date: Date, invoiceId: string }>();

    for (const inv of allInvoices) {
      const cname = inv.customerName;
      if (!cname) continue;
      if (!companyTotals.has(cname)) {
        const accName = customerMap.get(cname.toLowerCase().trim()) || "Unknown Account Holder";
        companyTotals.set(cname, { companyName: cname, accountName: accName, subTotal: 0, discount: 0, grandTotal: 0, pay: 0, due: 0, date: inv.createdAt, invoiceId: inv.id });
      }
      
      const curr = companyTotals.get(cname)!;
      const total = Number(inv.total || 0);
      const subtotal = Number(inv.subtotal || 0);
      const discount = subtotal - total > 0 ? subtotal - total : 0;
      
      curr.subTotal += subtotal;
      curr.discount += discount;
      curr.grandTotal += total;
      
      if (inv.createdAt > curr.date) {
        curr.date = inv.createdAt;
      }
    }

    const allInvoiceIds = allInvoices.map(i => i.id);
    let payments: any[] = [];
    
    if (allInvoiceIds.length > 0) {
      payments = await db.select().from(ledgerEntries).where(and(eq(ledgerEntries.category, 'Invoice Payment'), eq(ledgerEntries.entryType, 'Credit')));
      
      // Calculate pay and due. Real ledger_entries always win when they
      // exist — status==='Paid' alone no longer means "fully paid" now that
      // approval can record a partial amount (D-019); it only falls back to
      // the full total for legacy invoices marked Paid before any ledger
      // entry was ever written for them. A payment entry's currency can
      // differ from its invoice's (the approval flow always records PKR,
      // regardless of invoice currency) — convert here, at read time in full
      // float precision, rather than pre-rounding to 2dp at insert time,
      // which is what previously turned a round 30,000 PKR payment into
      // 29,999 once it round-tripped through a 2-decimal USD column.
      companyTotals.forEach((curr, cname) => {
        const companyInvoices = allInvoices.filter(i => i.customerName === cname);

        let totalPaid = 0;
        for (const inv of companyInvoices) {
          const invPayments = payments.filter((p: any) => p.referenceId === inv.id);
          const rate = Number(inv.dollarRate) || 280;
          const realPaid = invPayments.reduce((sum, p) => {
            const amt = Number(p.amount);
            if (!p.currency || p.currency === inv.currency) return sum + amt;
            if (inv.currency === 'USD' && p.currency === 'PKR') return sum + amt / rate;
            if (inv.currency === 'PKR' && p.currency === 'USD') return sum + amt * rate;
            return sum + amt;
          }, 0);
          totalPaid += realPaid > 0 ? realPaid : (inv.status === 'Paid' ? Number(inv.total || 0) : 0);
        }
        curr.pay = totalPaid;
        curr.due = curr.grandTotal - totalPaid;
      });
    }

    // Convert map to LedgerResponse format expected by frontend
    const results = Array.from(companyTotals.values()).map(c => {
      return {
        id: c.companyName,
        entryType: "Credit" as const,
        amount: c.subTotal.toString(),
        currency: "USD",
        description: c.companyName,
        category: "Company",
        referenceId: c.invoiceId,
        referenceType: "Invoice",
        balanceAfter: "0",
        entryDate: c.date.toISOString(),
        createdAt: c.date.toISOString(),
        accountName: c.accountName,
        grandTotal: c.grandTotal.toString(),
        pay: c.pay.toString(),
        due: c.due.toString(),
      };
    });

    const paginated = results.slice(offset, offset + limit);

    res.json({
      data: paginated,
      total: results.length,
      page: pageNum,
      pageSize: limit,
      summary: {
        totalGM: results.reduce((acc, r) => acc + Number(r.pay), 0),
        totalRefund: 0,
        totalInvoice: results.reduce((acc, r) => acc + Number(r.grandTotal), 0),
        totalDonation: 0,
        outstandingDues: results.reduce((acc, r) => acc + Number(r.due), 0)
      }
    });

  } catch (err) {
    console.error("Error fetching company ledger report:", err);
    res.status(500).json({ error: "Failed to fetch company ledger report" });
  }
});

// GET /api/account/history/:companyId
companyLedgerRouter.get("/api/account/history/:companyId", requireFinancialPermission(FINANCIAL_ACTIONS.accountLedgerView, { roles: FINANCIAL_VIEW_ROLES }), async (req, res) => {
  try {
    const { companyId } = req.params; // Using company name as ID for now since that's how it's linked

    // Invoices for this company
    const companyInvoices = await db.query.invoices.findMany({
      where: eq(invoices.customerName, companyId),
      orderBy: [desc(invoices.createdAt)]
    });

    // Payments for this company
    // Usually tied via referenceId = invoice.id
    const invoiceIds = companyInvoices.map((i: any) => i.id);
    let payments: any[] = [];

    if (invoiceIds.length > 0) {
      // Drizzle OR inArray is not imported, let's just use a loop for now or simple filtering if not many.
      payments = await db.select().from(ledgerEntries).where(and(eq(ledgerEntries.category, 'Invoice Payment'), eq(ledgerEntries.entryType, 'Credit')));
      payments = payments.filter((p: any) => invoiceIds.includes(p.referenceId));

      // Pull an optional receipt screenshot back out of `description` (see
      // POST /api/account/payment, which has nowhere else to put one), and
      // fall back to the invoice's own notes.receiptImage for entries the
      // approval flow created — that flow uploads straight to the invoice's
      // notes rather than this marker, so it would otherwise go missing now
      // that approved invoices get a real ledger entry of their own.
      payments = payments.map((p: any) => {
        const match = typeof p.description === "string" ? p.description.match(/\s*\[receipt:(.+?)\]/) : null;
        let receiptImage = match ? match[1] : null;
        const description = match ? p.description.replace(match[0], "") : p.description;
        if (!receiptImage) {
          const relatedInvoice = companyInvoices.find((inv) => inv.id === p.referenceId);
          try {
            const parsedNotes = relatedInvoice?.notes ? JSON.parse(relatedInvoice.notes) : null;
            receiptImage = parsedNotes?.receiptImage || null;
          } catch {
            // notes wasn't JSON — no receipt image to backfill.
          }
        }
        return { ...p, description, receiptImage };
      });
    }

    const customerRow = await db.query.customers.findFirst({
      where: ilike(customers.companyName, companyId)
    });

    const creatorIds = Array.from(new Set(companyInvoices.map((i) => i.createdByUserId).filter(Boolean)));
    let creatorNameById: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const creatorRows = await db.select({ id: users.id, fullName: users.fullName, name: users.name, username: users.username })
        .from(users)
        .where(inArray(users.id, creatorIds as string[]));
      creatorNameById = Object.fromEntries(creatorRows.map((u) => [u.id, u.fullName || u.name || u.username || "-"]));
    }

    // Invoices get marked status='Paid' directly by the Account Manager's
    // approve action (POST /api/account/pending-quotations/:id/approve),
    // which stores payment_method + notes.receiptNumber on the invoice row
    // itself and never writes a ledger_entries row. Without this, such
    // invoices show Due=0 in the list (computed straight off status==='Paid')
    // while their receipts/payment-list view finds nothing, since that only
    // ever reads ledger_entries.
    const paidInvoiceIds = new Set(payments.map((p: any) => p.referenceId));
    const syntheticReceipts = companyInvoices
      .filter((inv) => inv.status === "Paid" && !paidInvoiceIds.has(inv.id))
      .map((inv) => {
        let receiptNumber: string | null = null;
        let receiptImage: string | null = null;
        try {
          const parsedNotes = inv.notes ? JSON.parse(inv.notes) : null;
          receiptNumber = parsedNotes?.receiptNumber || null;
          receiptImage = parsedNotes?.receiptImage || null;
        } catch {
          // notes wasn't JSON — no receipt number/image to extract.
        }
        return {
          id: receiptNumber || inv.id,
          amount: inv.total,
          currency: inv.currency,
          entryDate: inv.updatedAt,
          referenceId: inv.id,
          referenceType: "Invoice",
          description: `Invoice ${inv.invoiceNumber} marked Paid on approval`,
          receiptImage,
          remarks: inv.paymentMethod || null,
        };
      });

    res.json({
      success: true,
      data: {
        invoices: companyInvoices.map((inv) => ({
          ...inv,
          createdByName: inv.createdByUserId ? (creatorNameById[inv.createdByUserId] || "-") : "-"
        })),
        receipts: [...payments, ...syntheticReceipts],
        customer: customerRow ? { phone: customerRow.phone, ntn: customerRow.ntn } : null
      }
    });
  } catch (err) {
    console.error("Error fetching account history:", err);
    res.status(500).json({ error: "Failed to fetch account history" });
  }
});

// POST /api/account/payment (Make Payment)
companyLedgerRouter.post("/api/account/payment", requireFinancialPermission(FINANCIAL_ACTIONS.accountLedgerCreate), async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { invoiceId, amount, paymentMethod, notes, entryDate, receiptImage } = req.body;

    if (!invoiceId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const inv = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId)
    });

    if (!inv) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // There's no dedicated column for an optional receipt screenshot on this
    // table, so (like the invoice-approval flow's notes.receiptImage) it's
    // tucked into the free-text description with a parseable marker and
    // extracted back out by the GET /api/account/history/:companyId reader.
    const description = `Payment for invoice ${inv.invoiceNumber}${notes ? ` - ${notes}` : ''}${receiptImage ? ` [receipt:${receiptImage}]` : ''}`;

    // `amount` is entered in PKR in both Make Payment modals (same convention
    // as the approval flow) — store it as PKR exactly as entered rather than
    // converting to the invoice's own currency up front, which would round
    // a figure like 30,000 down to 2 decimal places of USD and lose it on
    // the way back (see D-019). Readers convert at calculation time instead.
    const newEntry = await db.insert(ledgerEntries).values({
      entryType: "Credit",
      amount: amount.toString(),
      currency: "PKR",
      description,
      category: "Invoice Payment",
      referenceId: invoiceId,
      referenceType: "Invoice",
      entryDate: entryDate ? new Date(entryDate) : new Date(),
      createdByUserId: req.user.userId,
      status: "Posted",
      remarks: paymentMethod || null
    }).returning();

    res.json({
      success: true,
      message: "Payment recorded successfully",
      data: newEntry[0]
    });
  } catch (err) {
    console.error("Error creating payment:", err);
    res.status(500).json({ error: "Failed to create payment" });
  }
});
