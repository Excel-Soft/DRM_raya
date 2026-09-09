import { db } from "../db";
import {
  users,
  customers,
  services,
  serviceCustomers,
  serviceActivities,
  serviceTargets,
  serviceFollowups,
} from "../models";
import { eq, sql } from "drizzle-orm";

async function runTest() {
  console.log("Starting Service Department test data generation...");

  try {
    // 1. Get or create a mock user
    const user = await db.query.users.findFirst();
    if (!user) {
      throw new Error("No users found in database to attach test data to.");
    }

    const customer = await db.query.customers.findFirst();
    if (!customer) {
      throw new Error("No customers found in database to attach test data to.");
    }

    // 3. Insert Service Target for the user
    await db.execute(sql`ALTER TABLE "drm"."service_targets" DROP COLUMN IF EXISTS target_amount, DROP COLUMN IF EXISTS achieved_amount, DROP COLUMN IF EXISTS month, DROP COLUMN IF EXISTS year;`);
    await db.execute(sql`ALTER TABLE "drm"."service_targets" ADD COLUMN IF NOT EXISTS target_value numeric(10,2) NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS period text NOT NULL DEFAULT 'monthly', ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES "drm"."users"("id"), ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES "drm"."users"("id");`);

    await db.insert(serviceTargets).values({
      userId: user.id,
      targetType: "Mobile",
      targetValue: "15",
      period: "monthly",
    });
    
    await db.insert(serviceTargets).values({
      userId: user.id,
      targetType: "Whatsapp",
      targetValue: "20",
      period: "monthly",
    });

    // 4. Insert Service Customer
    await db.execute(sql`ALTER TABLE "drm"."service_customers" ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES "drm"."customers"("id");`);
    await db.execute(sql`ALTER TABLE "drm"."service_customers" RENAME COLUMN start_date TO service_start_date;`).catch(() => {}); // Catch if already renamed

    const [serviceCustomer] = await db.insert(serviceCustomers).values({
      userId: user.id,
      customerId: customer.id,
      serviceStartDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: "active",
      assignedTo: user.id,
    }).returning();

    // 5. Insert Activities (2 Mobile, 1 Whatsapp)
    await db.insert(serviceActivities).values([
      {
        userId: user.id,
        serviceCustomerId: serviceCustomer.id,
        method: "Mobile",
        durationMinutes: 10,
        activityDate: new Date(),
      },
      {
        userId: user.id,
        serviceCustomerId: serviceCustomer.id,
        method: "Mobile",
        durationMinutes: 15,
        activityDate: new Date(),
      },
      {
        userId: user.id,
        serviceCustomerId: serviceCustomer.id,
        method: "Whatsapp",
        durationMinutes: 5,
        activityDate: new Date(),
      }
    ]);

    // 6. Insert Followup
    await db.insert(serviceFollowups).values({
      serviceCustomerId: serviceCustomer.id,
      assignedTo: user.id,
      method: "Call",
      purpose: "Check-in",
      status: "pending",
      nextFollowupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    });

    console.log("✅ Successfully injected test data for Service Department!");
    
  } catch (error) {
    console.error("Test data generation failed:", error);
  } finally {
    process.exit(0);
  }
}

runTest();
