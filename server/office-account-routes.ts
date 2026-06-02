import { Router, Request, Response } from "express";
import { db } from "./db";
import { 
  accountHeads, officeExpenses, officeVas, cheques, businessCustomers, invoices, customers,
  insertAccountHeadSchema, insertOfficeExpenseSchema, insertOfficeVasSchema,
  insertChequeSchema, insertBusinessCustomerSchema
} from "@shared/schema";
import { eq, desc, and, gte, lte, ilike, or, notIlike, inArray } from "drizzle-orm";

const router = Router();

function getUserId(req: Request): string {
  return (req.user as any)?.id || (req.user as any)?.userId || "system";
}

// Account Heads
router.get("/account-heads", async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    
    const results = category
      ? await db.select().from(accountHeads).where(eq(accountHeads.category, category as any)).orderBy(accountHeads.code)
      : await db.select().from(accountHeads).orderBy(accountHeads.code);
    
    res.json(results);
  } catch (error) {
    console.error("Error fetching account heads:", error);
    res.status(500).json({ error: "Failed to fetch account heads" });
  }
});

router.post("/account-heads", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const data = insertAccountHeadSchema.parse(req.body);
    
    const [result] = await db.insert(accountHeads).values({
      ...data,
      createdByUserId: userId,
    }).returning();
    
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating account head:", error);
    res.status(500).json({ error: "Failed to create account head" });
  }
});

router.delete("/account-heads/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(accountHeads).where(eq(accountHeads.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting account head:", error);
    res.status(500).json({ error: "Failed to delete account head" });
  }
});

// Office Expenses
router.get("/expenses", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, office, accountingHead } = req.query;
    let conditions = [];
    
    if (startDate) {
      conditions.push(gte(officeExpenses.expenseDate, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(officeExpenses.expenseDate, new Date(endDate as string)));
    }
    if (office) {
      const officeArray = (office as string).split(",").filter(Boolean);
      if (officeArray.length > 0) {
        conditions.push(inArray(officeExpenses.office, officeArray));
      }
    }
    if (accountingHead) {
      const headArray = (accountingHead as string).split(",").filter(Boolean);
      if (headArray.length > 0) {
        conditions.push(inArray(officeExpenses.expenseHead, headArray));
      }
    }
    
    const results = await db.select().from(officeExpenses)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(officeExpenses.createdAt));
    
    res.json(results);
  } catch (error: any) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ error: "Failed to fetch expenses", details: error.message, stack: error.stack });
  }
});

router.post("/expenses", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const data = insertOfficeExpenseSchema.parse(req.body);
    
    const [result] = await db.insert(officeExpenses).values({
      ...data,
      createdByUserId: userId,
    }).returning();
    
    res.status(201).json(result);
  } catch (error: any) {
    console.error("Error creating expense:", error);
    res.status(500).json({ error: "Failed to create expense", details: error.message, stack: error.stack });
  }
});

router.delete("/expenses/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(officeExpenses).where(eq(officeExpenses.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

// Office VAS
router.get("/vas", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, search } = req.query;
    let conditions = [];
    
    if (startDate) {
      conditions.push(gte(invoices.issueDate, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(invoices.issueDate, new Date(endDate as string)));
    }
    if (search) {
      conditions.push(ilike(invoices.customerName, `%${search}%`));
    }
    
    // Exclude Alibaba related companies
    conditions.push(notIlike(invoices.customerName, '%alibaba%'));
    
    // Only show paid invoices since they asked for "amount paid"
    conditions.push(eq(invoices.status, 'Paid'));
    
    const results = await db.select().from(invoices)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(invoices.issueDate));
      
    const mapped = results.map(inv => {
      let method = "-";
      try {
        const p = JSON.parse(inv.notes || '{}');
        method = p.paymentMethod || "-";
      } catch (e) {}
      
      return {
        id: inv.id,
        companyName: inv.customerName,
        amount: inv.total,
        currency: inv.currency || "USD",
        method: method,
        vasDate: inv.paidAt || inv.issueDate,
        createdAt: inv.createdAt
      };
    });
    
    res.json(mapped);
  } catch (error) {
    console.error("Error fetching VAS entries:", error);
    res.status(500).json({ error: "Failed to fetch VAS entries" });
  }
});

router.post("/vas", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const data = insertOfficeVasSchema.parse(req.body);
    
    const [result] = await db.insert(officeVas).values({
      ...data,
      createdByUserId: userId,
    }).returning();
    
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating VAS entry:", error);
    res.status(500).json({ error: "Failed to create VAS entry" });
  }
});

router.delete("/vas/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(officeVas).where(eq(officeVas.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting VAS entry:", error);
    res.status(500).json({ error: "Failed to delete VAS entry" });
  }
});

// Cheques
router.get("/cheques", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, search } = req.query;
    let conditions = [];
    
    if (startDate) {
      conditions.push(gte(cheques.chequeDate, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(cheques.chequeDate, new Date(endDate as string)));
    }
    if (status) {
      conditions.push(eq(cheques.status, status as any));
    }
    if (search) {
      conditions.push(or(
        ilike(cheques.companyName, `%${search}%`),
        ilike(cheques.chequeNumber, `%${search}%`),
        ilike(cheques.bankName, `%${search}%`)
      ));
    }
    
    const results = await db.select().from(cheques)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(cheques.chequeDate));
      
    // Fetch all expenses to calculate used amounts for cheques
    let usedMap: Record<string, number> = {};
    try {
      const allExpenses = await db.select({
        chequeNumber: officeExpenses.chequeNumber,
        amount: officeExpenses.amount
      }).from(officeExpenses);
      
      usedMap = allExpenses.reduce((acc, exp) => {
          if (exp.chequeNumber) {
              acc[exp.chequeNumber] = (acc[exp.chequeNumber] || 0) + parseFloat(exp.amount as string || "0");
          }
          return acc;
      }, {} as Record<string, number>);
    } catch (e) {
      console.warn("Could not query office_expenses for used cheques. Schema may be outdated.");
    }
    
    const enrichedResults = results.map(c => {
        const used = usedMap[c.chequeNumber] || usedMap[c.id] || 0;
        const total = parseFloat(c.amount as string || "0");
        const remaining = Math.max(0, total - used);
        
        return {
            ...c,
            usedAmount: used,
            remainingAmount: remaining.toFixed(2)
        };
    });
    
    res.json(enrichedResults);
  } catch (error: any) {
    console.error("Error fetching cheques:", error);
    res.status(500).json({ error: "Failed to fetch cheques", details: error.message, stack: error.stack });
  }
});

router.post("/cheques", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const data = insertChequeSchema.parse(req.body);
    
    const [result] = await db.insert(cheques).values({
      ...data,
      createdByUserId: userId,
    }).returning();
    
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating cheque:", error);
    res.status(500).json({ error: "Failed to create cheque" });
  }
});

router.patch("/cheques/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const [result] = await db.update(cheques)
      .set({ status, updatedAt: new Date() })
      .where(eq(cheques.id, id))
      .returning();
    
    res.json(result);
  } catch (error) {
    console.error("Error updating cheque status:", error);
    res.status(500).json({ error: "Failed to update cheque status" });
  }
});

router.delete("/cheques/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(cheques).where(eq(cheques.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting cheque:", error);
    res.status(500).json({ error: "Failed to delete cheque" });
  }
});

// Business Customers
router.get("/business-customers", async (req: Request, res: Response) => {
  try {
    const { search } = req.query;
    let conditions = [];
    
    if (search) {
      conditions.push(or(
        ilike(customers.companyName, `%${search}%`),
        ilike(customers.phone, `%${search}%`),
        ilike(customers.cnic, `%${search}%`),
        ilike(customers.ntn, `%${search}%`)
      ));
    }
    
    const results = await db.select().from(customers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(customers.createdAt));
      
    // Fetch live invoices to calculate real totalPaid and totalDue
    const allInvoices = await db.select().from(invoices);
    
    // Create a map of customer id/name to amounts
    const companyTotals = allInvoices.reduce((acc, inv) => {
       // Match by customerId first, then by customerName fallback
       const matchKey = inv.customerId || (inv.customerName || '').toLowerCase().trim();
       if (!matchKey) return acc;
       
       if (!acc[matchKey]) {
           acc[matchKey] = { paid: 0, due: 0 };
       }
       const amount = parseFloat(inv.total as string) || 0;
       if (inv.status === 'Paid') {
           acc[matchKey].paid += amount;
       } else if (inv.status === 'Pending' || inv.status === 'Sent' || inv.status === 'Overdue') {
           acc[matchKey].due += amount;
       }
       return acc;
    }, {} as Record<string, { paid: number, due: number }>);
    
    // Map the results to include real live data
    const liveResults = results.map(customer => {
       const nameMatch = (customer.companyName || '').toLowerCase().trim();
       const liveTotals = companyTotals[customer.id] || companyTotals[nameMatch];
       
       return {
           id: customer.id,
           companyName: customer.companyName,
           phone: customer.phone,
           cnic: customer.cnic,
           ntn: customer.ntn,
           createdAt: customer.createdAt,
           totalPaid: liveTotals ? liveTotals.paid.toString() : "0",
           totalDue: liveTotals ? liveTotals.due.toString() : "0"
       };
    });
    
    res.json(liveResults);
  } catch (error: any) {
    console.error("Error fetching business customers:", error);
    res.status(500).json({ error: "Failed to fetch business customers", details: error.message, stack: error.stack });
  }
});

router.post("/business-customers", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const data = insertBusinessCustomerSchema.parse(req.body);
    
    const [result] = await db.insert(businessCustomers).values({
      ...data,
      createdByUserId: userId,
    }).returning();
    
    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating business customer:", error);
    res.status(500).json({ error: "Failed to create business customer" });
  }
});

router.delete("/business-customers/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(businessCustomers).where(eq(businessCustomers.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting business customer:", error);
    res.status(500).json({ error: "Failed to delete business customer" });
  }
});

export default router;
