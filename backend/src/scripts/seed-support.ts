import { db } from "../db";
import {
  users,
  customers,
  supportChannelConfig,
  supportTickets,
  supportMessages,
} from "@models/schema";

async function seedSupport() {
  console.log("🌱 Seeding Support module...");

  // Get existing user and customers
  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    console.error("❌ No user found. Please run main seed script first.");
    return;
  }

  const existingCustomers = await db.select().from(customers);
  if (existingCustomers.length === 0) {
    console.error("❌ No customers found. Please run main seed script first.");
    return;
  }

  // Create Support channel configurations
  const channelConfigData = [
    {
      channel: "whatsapp" as const,
      isActive: 1,
      displayName: "WhatsApp",
    },
    {
      channel: "web" as const,
      isActive: 1,
      displayName: "Web Chat",
    },
    {
      channel: "email" as const,
      isActive: 1,
      displayName: "Email Support",
    },
    {
      channel: "phone" as const,
      isActive: 1,
      displayName: "Phone Support",
    },
  ];

  const insertedChannelConfigs = await db.insert(supportChannelConfig).values(channelConfigData).returning();
  console.log(`✓ Created ${insertedChannelConfigs.length} support channel configs`);

  // Create Support tickets
  const ticketData = [
    {
      customerId: existingCustomers[0].id,
      createdBy: user.id,
      channel: "web" as const,
      subject: "Unable to access dashboard",
      status: "Open" as const,
      priority: "High" as const,
      assignedToUserId: user.id,
      dataSend: 0,
    },
    {
      customerId: existingCustomers[1]?.id || existingCustomers[0].id,
      createdBy: user.id,
      channel: "whatsapp" as const,
      subject: "Need help with renewal process",
      status: "InProgress" as const,
      priority: "Medium" as const,
      assignedToUserId: user.id,
      dataSend: 1,
    },
    {
      customerId: existingCustomers[2]?.id || existingCustomers[0].id,
      createdBy: user.id,
      channel: "email" as const,
      subject: "Question about pricing tiers",
      status: "Open" as const,
      priority: "Low" as const,
      dataSend: 0,
    },
    {
      customerId: existingCustomers[0].id,
      createdBy: user.id,
      channel: "phone" as const,
      subject: "Technical issue with integration",
      status: "Resolved" as const,
      priority: "High" as const,
      assignedToUserId: user.id,
      dataSend: 1,
    },
    {
      customerId: existingCustomers[1]?.id || existingCustomers[0].id,
      createdBy: user.id,
      channel: "web" as const,
      subject: "Feature request: Export to CSV",
      status: "Open" as const,
      priority: "Medium" as const,
      dataSend: 0,
    },
  ];

  const insertedTickets = await db.insert(supportTickets).values(ticketData).returning();
  console.log(`✓ Created ${insertedTickets.length} support tickets`);

  // Create Support messages
  const messageData = [
    {
      ticketId: insertedTickets[0].id,
      from: "customer" as const,
      body: "I can't log into my dashboard. It says my credentials are invalid.",
    },
    {
      ticketId: insertedTickets[0].id,
      from: "agent" as const,
      body: "Thank you for contacting us. I'll help you resolve this issue. Can you confirm your email address?",
    },
    {
      ticketId: insertedTickets[1].id,
      from: "customer" as const,
      body: "Hi, I need to renew my subscription but I'm not sure which plan to choose.",
    },
    {
      ticketId: insertedTickets[1].id,
      from: "agent" as const,
      body: "I'd be happy to help you with the renewal. Let me review your current usage and recommend the best plan.",
    },
    {
      ticketId: insertedTickets[2].id,
      from: "customer" as const,
      body: "What are the differences between your Standard and Premium tiers?",
    },
    {
      ticketId: insertedTickets[3].id,
      from: "customer" as const,
      body: "Our API integration is returning 500 errors when we try to sync customer data.",
    },
    {
      ticketId: insertedTickets[3].id,
      from: "agent" as const,
      body: "I've identified the issue. There was a temporary problem with our API. It's now resolved. Please try again.",
    },
    {
      ticketId: insertedTickets[3].id,
      from: "customer" as const,
      body: "Confirmed, it's working now. Thank you!",
    },
    {
      ticketId: insertedTickets[4].id,
      from: "customer" as const,
      body: "It would be really helpful if we could export our data to CSV format.",
    },
  ];

  await db.insert(supportMessages).values(messageData);
  console.log(`✓ Created ${messageData.length} support messages`);

  console.log("✅ Support module seeding completed successfully!");
}

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSupport()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Support seeding failed:", error);
      process.exit(1);
    });
}

export { seedSupport };
