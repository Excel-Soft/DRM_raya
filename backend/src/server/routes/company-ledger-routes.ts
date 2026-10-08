import { Router } from "express";
import { db } from "../db";
import { ledgerEntries, invoices, customers } from "../../shared/schema";
import { eq, desc, sql, and, ilike, or, gte, lte } from "drizzle-orm";
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
      
      // Calculate pay and due
      companyTotals.forEach((curr, cname) => {
        const companyInvoices = allInvoices.filter(i => i.customerName === cname);
        
        let totalPaid = 0;
        for (const inv of companyInvoices) {
          if (inv.status === 'Paid') {
             totalPaid += Number(inv.total || 0);
          } else {
             const invPayments = payments.filter((p: any) => p.referenceId === inv.id);
             totalPaid += invPayments.reduce((sum, p) => sum + Number(p.amount), 0);
          }
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
    }

    res.json({
      success: true,
      data: {
        invoices: companyInvoices,
        receipts: payments
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
    
    const { invoiceId, amount, paymentMethod, notes, entryDate } = req.body;
    
    if (!invoiceId || !amount) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const inv = await db.query.invoices.findFirst({
      where: eq(invoices.id, invoiceId)
    });

    if (!inv) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Create a ledger entry for the payment
    const newEntry = await db.insert(ledgerEntries).values({
      entryType: "Credit",
      amount: amount.toString(),
      currency: inv.currency || "USD",
      description: `Payment for invoice ${inv.invoiceNumber}${notes ? ` - ${notes}` : ''}`,
      category: "Invoice Payment",
      referenceId: invoiceId,
      referenceType: "Invoice",
      entryDate: entryDate ? new Date(entryDate) : new Date(),
      createdByUserId: req.user.userId,
      status: "Posted"
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
