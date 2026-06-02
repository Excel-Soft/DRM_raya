import { db } from "../server/db";
import { projects, productPostingInvoices, users } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
  const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt)).limit(10);
  console.log("=== Recent 10 Projects ===");
  for (const p of allProjects) {
    const [owner] = await db.select().from(users).where(eq(users.id, p.ownerUserId || ""));
    console.log(`Project: ${p.name}\n  ID: ${p.id}\n  Owner: ${owner?.fullName || "None"} (${owner?.username || "None"})\n  InvoiceId: ${p.invoiceId}`);
  }

  const allInvoices = await db.select().from(productPostingInvoices).orderBy(desc(productPostingInvoices.createdAt)).limit(10);
  console.log("\n=== Recent 10 Invoices ===");
  for (const inv of allInvoices) {
    const [salesExec] = await db.select().from(users).where(eq(users.id, inv.salesExecId || ""));
    console.log(`Invoice for: ${inv.projectName || inv.companyName}\n  ID: ${inv.id}\n  Sales Exec: ${salesExec?.fullName || "None"} (${salesExec?.username || "None"})\n  Status: ${inv.status}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
