import { db } from "./db";
import {
  users,
  customers,
  opportunities,
  activities,
  followUps,
  appointments,
  targets,
  vasProgressSnapshots,
  projects,
  tasks,
  taskComments,
  supportChannelConfig,
  supportTickets,
  supportMessages,
  trainingModules,
  trainingProgress,
  roles,
  permissions,
  rolePermissions,
  projectFinancials,
  projectApprovals,
  projectAssignments,
  taskTimeLogs,
  taskStatusHistory,
} from "@shared/schema";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create/update test users (upsert)
  const [user] = await db.insert(users).values({
    username: "john.doe",
    email: "john.doe@webexcels.com",
    password: "password123", // In production, this would be hashed
    name: "John Doe",
    roleId: "sales_executive",
    branch: "Dubai",
    country: "UAE",
  }).onConflictDoUpdate({
    target: users.username,
    set: {
      email: "john.doe@webexcels.com",
      name: "John Doe",
      roleId: "sales_executive",
      branch: "Dubai",
      country: "UAE",
    },
  }).returning();

  const [adminUser] = await db.insert(users).values({
    username: "admin",
    email: "admin@webexcels.com",
    password: "admin123", // In production, this would be hashed
    name: "Admin User",
    roleId: "admin",
    branch: "HQ",
    country: "UAE",
  }).onConflictDoUpdate({
    target: users.username,
    set: {
      email: "admin@webexcels.com",
      name: "Admin User",
      roleId: "admin",
      branch: "HQ",
      country: "UAE",
    },
  }).returning();

  console.log("✓ Created/updated users:", user.email, ",", adminUser.email);

  // Create RBAC Roles
  const roleData = [
    { name: "admin", description: "Full system access and management" },
    { name: "hod", description: "Head of Department - team oversight and approvals" },
    { name: "manager", description: "Team management and reporting" },
    { name: "assistant_manager", description: "Assistant manager with limited admin access" },
    { name: "sales_executive", description: "Sales operations and customer management" },
  ];

  const insertedRoles: any[] = [];
  for (const role of roleData) {
    const [insertedRole] = await db.insert(roles).values(role)
      .onConflictDoUpdate({
        target: roles.name,
        set: { description: role.description },
      })
      .returning();
    insertedRoles.push(insertedRole);
  }
  console.log(`✓ Created/updated ${insertedRoles.length} roles`);

  // Create Permissions
  const permissionData = [
    // Customer Module
    { name: "customers:read", description: "View customers", module: "customers", action: "read" },
    { name: "customers:write", description: "Create and edit customers", module: "customers", action: "write" },
    { name: "customers:delete", description: "Delete customers", module: "customers", action: "delete" },
    { name: "customers:approve", description: "Approve customer promotions", module: "customers", action: "approve" },
    { name: "customers:manage", description: "Full customer management", module: "customers", action: "manage" },
    // PMS Module
    { name: "pms:read", description: "View projects and tasks", module: "pms", action: "read" },
    { name: "pms:write", description: "Create and edit projects/tasks", module: "pms", action: "write" },
    { name: "pms:delete", description: "Delete projects/tasks", module: "pms", action: "delete" },
    { name: "pms:approve", description: "Approve projects", module: "pms", action: "approve" },
    { name: "pms:manage", description: "Full PMS management", module: "pms", action: "manage" },
    // HR Module
    { name: "hr:read", description: "View HR records", module: "hr", action: "read" },
    { name: "hr:write", description: "Submit HR requests", module: "hr", action: "write" },
    { name: "hr:approve", description: "Approve HR requests", module: "hr", action: "approve" },
    { name: "hr:manage", description: "Full HR management", module: "hr", action: "manage" },
    // Support Module
    { name: "support:read", description: "View support tickets", module: "support", action: "read" },
    { name: "support:write", description: "Create and respond to tickets", module: "support", action: "write" },
    { name: "support:manage", description: "Full support management", module: "support", action: "manage" },
    // Reports Module
    { name: "reports:read", description: "View reports", module: "reports", action: "read" },
    { name: "reports:export", description: "Export reports", module: "reports", action: "export" },
    { name: "reports:team", description: "View team reports", module: "reports", action: "team" },
    { name: "reports:manage", description: "Full reports access", module: "reports", action: "manage" },
    // Settings Module
    { name: "settings:read", description: "View settings", module: "settings", action: "read" },
    { name: "settings:write", description: "Modify settings", module: "settings", action: "write" },
    { name: "settings:manage", description: "Full settings management", module: "settings", action: "manage" },
    // Training Module
    { name: "training:read", description: "Access training materials", module: "training", action: "read" },
    { name: "training:manage", description: "Manage training content", module: "training", action: "manage" },
  ];

  const insertedPermissions: any[] = [];
  for (const perm of permissionData) {
    const [insertedPerm] = await db.insert(permissions).values(perm)
      .onConflictDoUpdate({
        target: permissions.name,
        set: { description: perm.description, module: perm.module, action: perm.action },
      })
      .returning();
    insertedPermissions.push(insertedPerm);
  }
  console.log(`✓ Created/updated ${insertedPermissions.length} permissions`);

  // Assign permissions to roles
  const adminRole = insertedRoles.find(r => r.name === "admin");
  const hodRole = insertedRoles.find(r => r.name === "hod");
  const managerRole = insertedRoles.find(r => r.name === "manager");
  const salesRole = insertedRoles.find(r => r.name === "sales_executive");

  // Clear existing role permissions first
  await db.delete(rolePermissions);

  // Admin gets all permissions
  const adminPermissions = insertedPermissions.map(p => ({
    roleId: adminRole.id,
    permissionId: p.id,
  }));
  await db.insert(rolePermissions).values(adminPermissions);

  // HOD gets most permissions except settings:manage
  const hodPerms = insertedPermissions.filter(p => 
    !p.name.includes("settings:manage") && !p.name.includes(":delete")
  );
  await db.insert(rolePermissions).values(hodPerms.map(p => ({
    roleId: hodRole.id,
    permissionId: p.id,
  })));

  // Manager gets read/write/approve for most modules
  const managerPerms = insertedPermissions.filter(p => 
    p.action !== "manage" && p.action !== "delete"
  );
  await db.insert(rolePermissions).values(managerPerms.map(p => ({
    roleId: managerRole.id,
    permissionId: p.id,
  })));

  // Sales Executive gets read/write for their modules
  const salesPerms = insertedPermissions.filter(p => 
    (p.action === "read" || p.action === "write") &&
    (p.module === "customers" || p.module === "pms" || p.module === "hr" || p.module === "training")
  );
  await db.insert(rolePermissions).values(salesPerms.map(p => ({
    roleId: salesRole.id,
    permissionId: p.id,
  })));

  console.log("✓ Assigned permissions to roles");

  // Create sample customers
  const customerData = [
    {
      companyName: "Acme Corp",
      accountName: "AC-001",
      email: "contact@acme.com",
      phone: "+971-555-0101",
      region: "Dubai",
      grade: "A+",
      status: "New" as const,
      ntn: "NTN-001",
      lastNote: "Initial contact made",
    },
    {
      companyName: "Tech Solutions",
      accountName: "TS-042",
      email: "info@techsolutions.com",
      phone: "+971-555-0102",
      region: "Abu Dhabi",
      grade: "B+",
      status: "Renew" as const,
      ntn: "NTN-042",
      lastNote: "Renewal discussion in progress",
    },
    {
      companyName: "Global Trade Co",
      accountName: "GT-123",
      email: "sales@globaltrade.com",
      phone: "+971-555-0103",
      region: "Sharjah",
      grade: "A-",
      status: "New" as const,
      ntn: "NTN-123",
      lastNote: "Waiting for decision",
    },
  ];

  const insertedCustomers = await db.insert(customers).values(customerData).returning();
  console.log(`✓ Created ${insertedCustomers.length} customers`);

  // Create opportunities for each customer
  const opportunityData = insertedCustomers.map((customer, index) => ({
    customerId: customer.id,
    ownerUserId: user.id,
    stage: (["LD", "QF", "AY"] as const)[index % 3],
    amount: ((index + 1) * 5000).toString(),
  }));

  await db.insert(opportunities).values(opportunityData);
  console.log(`✓ Created ${opportunityData.length} opportunities`);

  // Create activities
  const today = new Date();
  const activityData = [
    {
      userId: user.id,
      customerId: insertedCustomers[0].id,
      method: "mobile" as const,
      durationMinutes: 45,
      dateTime: new Date(today.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
      note: "Discussed membership options",
    },
    {
      userId: user.id,
      customerId: insertedCustomers[1].id,
      method: "email" as const,
      durationMinutes: 15,
      dateTime: new Date(today.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
      note: "Sent renewal proposal",
    },
    {
      userId: user.id,
      customerId: insertedCustomers[2].id,
      method: "whatsapp" as const,
      durationMinutes: 30,
      dateTime: new Date(today.getTime() - 6 * 60 * 60 * 1000), // 6 hours ago
      note: "Quick follow-up on pricing",
    },
  ];

  await db.insert(activities).values(activityData);
  console.log(`✓ Created ${activityData.length} activities`);

  // Create appointments for today
  const appointmentData = [
    {
      userId: user.id,
      customerId: insertedCustomers[0].id,
      purpose: "New Sell",
      dateTime: new Date(today.setHours(10, 0, 0, 0)),
    },
    {
      userId: user.id,
      customerId: insertedCustomers[1].id,
      purpose: "Renew Sell",
      dateTime: new Date(today.setHours(14, 30, 0, 0)),
    },
  ];

  await db.insert(appointments).values(appointmentData);
  console.log(`✓ Created ${appointmentData.length} appointments`);

  // Create follow-ups
  const followUpData = [
    {
      assignedTo: user.id,
      createdBy: user.id,
      customerId: insertedCustomers[0].id,
      dueAt: new Date(),
      dateTime: new Date(),
      status: "Open" as const,
      notes: "Pending payment confirmation",
      method: "Call",
    },
  ];

  await db.insert(followUps).values(followUpData);
  console.log(`✓ Created ${followUpData.length} follow-ups`);

  // Create targets
  const targetData = [
    {
      userId: user.id,
      type: "AB" as const,
      name: "$1k - $49k",
      bonusType: "percentage",
      bonusValue: "10%",
      priceTarget: "$50,000",
      rewardText: "$500",
      kwaRequirement: "5",
      vasRequirement: "3",
    },
    {
      userId: user.id,
      type: "AB" as const,
      name: "$50k - $99k",
      bonusType: "percentage",
      bonusValue: "15%",
      priceTarget: "$100,000",
      rewardText: "$1,500",
      kwaRequirement: "10",
      vasRequirement: "7",
    },
    {
      userId: user.id,
      type: "VAS" as const,
      name: "$1k - $29k",
      bonusType: "percentage",
      bonusValue: "8%",
      priceTarget: "$30,000",
      rewardText: "$300",
      kwaRequirement: "3",
      vasRequirement: "5",
    },
  ];

  await db.insert(targets).values(targetData);
  console.log(`✓ Created ${targetData.length} targets`);

  // Create VAS progress snapshot
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  await db.insert(vasProgressSnapshots).values({
    userId: user.id,
    periodMonth: currentMonth,
    periodYear: currentYear,
    amount: "28000",
    targetAmount: "45000",
  });
  console.log("✓ Created VAS progress snapshot");

  // Create PMS projects
  const projectData = [
    {
      name: "WebExcels DRM Development",
      description: "Main development project for the DRM system",
      ownerUserId: user.id,
      workSpace: "Development",
      status: "Active" as const,
      startDate: new Date("2025-01-01"),
    },
    {
      name: "Sales Team Training",
      description: "Training program for new sales team members",
      ownerUserId: user.id,
      workSpace: "HR",
      status: "Active" as const,
      startDate: new Date("2025-11-01"),
      endDate: new Date("2025-12-31"),
    },
  ];

  const insertedProjects = await db.insert(projects).values(projectData).returning();
  console.log(`✓ Created ${insertedProjects.length} projects`);

  // Create Project Financials
  const financialData = [
    {
      projectId: insertedProjects[0].id,
      totalAmount: "50000.00",
      paidAmount: "25000.00",
      currency: "USD",
      lastPaymentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      projectId: insertedProjects[1].id,
      totalAmount: "15000.00",
      paidAmount: "15000.00",
      currency: "USD",
      lastPaymentAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  ];

  await db.insert(projectFinancials).values(financialData);
  console.log(`✓ Created ${financialData.length} project financials`);

  // Create Project Approvals
  const approvalData = [
    {
      projectId: insertedProjects[0].id,
      stage: "HOD",
      status: "Pending" as const,
      requestedBy: user.id,
    },
    {
      projectId: insertedProjects[0].id,
      stage: "Department",
      status: "Pending" as const,
      requestedBy: user.id,
    },
    {
      projectId: insertedProjects[1].id,
      stage: "HOD",
      status: "Approved" as const,
      requestedBy: user.id,
      approverUserId: adminUser.id,
      approvedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  ];

  await db.insert(projectApprovals).values(approvalData);
  console.log(`✓ Created ${approvalData.length} project approvals`);

  // Create Project Assignments
  const assignmentData = [
    {
      projectId: insertedProjects[0].id,
      userId: user.id,
      role: "Lead",
    },
    {
      projectId: insertedProjects[0].id,
      userId: adminUser.id,
      role: "Reviewer",
    },
    {
      projectId: insertedProjects[1].id,
      userId: user.id,
      role: "Member",
    },
  ];

  await db.insert(projectAssignments).values(assignmentData);
  console.log(`✓ Created ${assignmentData.length} project assignments`);

  // Create PMS tasks
  const taskData = [
    {
      projectId: insertedProjects[0].id,
      title: "Implement PMS Backend",
      description: "Create database schema, repositories, and API routes for PMS module",
      ownerUserId: user.id,
      participants: [user.id],
      category: "Work" as const,
      priority: "High" as const,
      status: "InProgress" as const,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    {
      projectId: insertedProjects[0].id,
      title: "Design UI for Task Board",
      description: "Create Kanban board interface for task management",
      ownerUserId: user.id,
      participants: [user.id],
      category: "Work" as const,
      priority: "Medium" as const,
      status: "ToDo" as const,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    },
    {
      projectId: insertedProjects[1].id,
      title: "Prepare Training Materials",
      description: "Create slides and documentation for sales training",
      ownerUserId: user.id,
      participants: [user.id],
      category: "Work" as const,
      priority: "High" as const,
      status: "Completed" as const,
    },
    {
      title: "Weekly Team Meeting",
      description: "Discuss project progress and blockers",
      ownerUserId: user.id,
      participants: [user.id],
      category: "Meeting" as const,
      priority: "Medium" as const,
      status: "ToDo" as const,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    },
    {
      title: "Update Personal Development Plan",
      description: "Review and update yearly development goals",
      ownerUserId: user.id,
      participants: [user.id],
      category: "Personal" as const,
      priority: "Low" as const,
      status: "ToDo" as const,
    },
  ];

  const insertedTasks = await db.insert(tasks).values(taskData).returning();
  console.log(`✓ Created ${insertedTasks.length} tasks`);

  // Create Task Time Logs
  const timeLogData = [
    {
      taskId: insertedTasks[0].id,
      userId: user.id,
      timeSpentMinutes: 120,
      description: "Initial database schema design",
      logDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      taskId: insertedTasks[0].id,
      userId: user.id,
      timeSpentMinutes: 90,
      description: "Repository layer implementation",
      logDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      taskId: insertedTasks[0].id,
      userId: user.id,
      timeSpentMinutes: 60,
      description: "API routes development",
      logDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      taskId: insertedTasks[2].id,
      userId: user.id,
      timeSpentMinutes: 180,
      description: "Created training presentation slides",
      logDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
  ];

  await db.insert(taskTimeLogs).values(timeLogData);
  console.log(`✓ Created ${timeLogData.length} task time logs`);

  // Create Task Status History
  const statusHistoryData = [
    {
      taskId: insertedTasks[0].id,
      userId: user.id,
      fromStatus: "ToDo" as const,
      toStatus: "InProgress" as const,
      changedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      notes: "Started working on implementation",
    },
    {
      taskId: insertedTasks[2].id,
      userId: user.id,
      fromStatus: "ToDo" as const,
      toStatus: "InProgress" as const,
      changedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      taskId: insertedTasks[2].id,
      userId: user.id,
      fromStatus: "InProgress" as const,
      toStatus: "Completed" as const,
      changedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      notes: "Training materials approved by management",
    },
  ];

  await db.insert(taskStatusHistory).values(statusHistoryData);
  console.log(`✓ Created ${statusHistoryData.length} task status history records`);

  // Create task comments
  const commentData = [
    {
      taskId: insertedTasks[0].id,
      userId: user.id,
      comment: "Started working on the database schema. Created projects, tasks, and taskComments tables.",
    },
    {
      taskId: insertedTasks[0].id,
      userId: user.id,
      comment: "Implemented repository layer with proper authorization checks.",
    },
    {
      taskId: insertedTasks[2].id,
      userId: user.id,
      comment: "Training materials are ready. Reviewed by management and approved.",
    },
  ];

  await db.insert(taskComments).values(commentData);
  console.log(`✓ Created ${commentData.length} task comments`);

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

  const insertedChannelConfigs: any[] = [];
  for (const config of channelConfigData) {
    const [inserted] = await db.insert(supportChannelConfig).values(config)
      .onConflictDoUpdate({
        target: supportChannelConfig.channel,
        set: { isActive: config.isActive, displayName: config.displayName },
      })
      .returning();
    insertedChannelConfigs.push(inserted);
  }
  console.log(`✓ Created/updated ${insertedChannelConfigs.length} support channel configs`);

  // Create Support tickets
  const ticketData = [
    {
      customerId: insertedCustomers[0].id,
      channel: "web" as const,
      subject: "Unable to access dashboard",
      status: "Open" as const,
      priority: "High" as const,
      assignedToUserId: user.id,
      dataSend: 0,
    },
    {
      customerId: insertedCustomers[1].id,
      channel: "whatsapp" as const,
      subject: "Need help with renewal process",
      status: "InProgress" as const,
      priority: "Medium" as const,
      assignedToUserId: user.id,
      dataSend: 1,
    },
    {
      customerId: insertedCustomers[2].id,
      channel: "email" as const,
      subject: "Question about pricing tiers",
      status: "Open" as const,
      priority: "Low" as const,
      dataSend: 0,
    },
    {
      customerId: insertedCustomers[0].id,
      channel: "phone" as const,
      subject: "Technical issue with integration",
      status: "Resolved" as const,
      priority: "High" as const,
      assignedToUserId: user.id,
      dataSend: 1,
    },
    {
      customerId: insertedCustomers[1].id,
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

  // Create Training Modules
  const trainingModuleData = [
    // DRM Training Modules
    {
      title: "Introduction to DRM System",
      description: "Learn the basics of the Data Relationship Management system and how it helps you manage customer relationships effectively.",
      category: "DRM" as const,
      contentType: "video" as const,
      contentUrl: "https://example.com/training/drm-intro",
      estimatedMinutes: 30,
      orderIndex: 1,
      isActive: 1,
    },
    {
      title: "Customer Pipeline Management",
      description: "Master the customer pipeline stages from Lead to Gold Member status.",
      category: "DRM" as const,
      contentType: "video" as const,
      contentUrl: "https://example.com/training/drm-pipeline",
      estimatedMinutes: 45,
      orderIndex: 2,
      isActive: 1,
    },
    {
      title: "Follow-up Best Practices",
      description: "Learn effective follow-up strategies to convert leads into drm.customers.",
      category: "DRM" as const,
      contentType: "document" as const,
      contentUrl: "https://example.com/training/drm-followup-guide.pdf",
      estimatedMinutes: 20,
      orderIndex: 3,
      isActive: 1,
    },
    // SEO Training Modules
    {
      title: "SEO Fundamentals",
      description: "Understanding search engine optimization basics for better online visibility.",
      category: "SEO" as const,
      contentType: "video" as const,
      contentUrl: "https://example.com/training/seo-fundamentals",
      estimatedMinutes: 40,
      orderIndex: 1,
      isActive: 1,
    },
    {
      title: "Keyword Research Strategies",
      description: "Learn how to find and target the right keywords for your clients.",
      category: "SEO" as const,
      contentType: "video" as const,
      contentUrl: "https://example.com/training/seo-keywords",
      estimatedMinutes: 35,
      orderIndex: 2,
      isActive: 1,
    },
    {
      title: "On-Page SEO Checklist",
      description: "Complete checklist for optimizing web pages for search engines.",
      category: "SEO" as const,
      contentType: "document" as const,
      contentUrl: "https://example.com/training/seo-checklist.pdf",
      estimatedMinutes: 15,
      orderIndex: 3,
      isActive: 1,
    },
    // Alibaba Training Modules
    {
      title: "Alibaba Portal Overview",
      description: "Introduction to the Alibaba.com portal and its features for business.",
      category: "Alibaba" as const,
      contentType: "video" as const,
      contentUrl: "https://example.com/training/alibaba-overview",
      estimatedMinutes: 50,
      orderIndex: 1,
      isActive: 1,
    },
    {
      title: "Creating Effective Product Listings",
      description: "Best practices for creating product listings that attract buyers.",
      category: "Alibaba" as const,
      contentType: "video" as const,
      contentUrl: "https://example.com/training/alibaba-listings",
      estimatedMinutes: 40,
      orderIndex: 2,
      isActive: 1,
    },
    {
      title: "Trade Assurance Guide",
      description: "Understanding and utilizing Alibaba Trade Assurance for secure transactions.",
      category: "Alibaba" as const,
      contentType: "document" as const,
      contentUrl: "https://example.com/training/alibaba-trade-assurance.pdf",
      estimatedMinutes: 25,
      orderIndex: 3,
      isActive: 1,
    },
    // Sales Tools Training Modules
    {
      title: "Sales Scripts Library",
      description: "Collection of proven sales scripts for different customer scenarios.",
      category: "SalesTools" as const,
      contentType: "document" as const,
      contentUrl: "https://example.com/training/sales-scripts.pdf",
      estimatedMinutes: 30,
      orderIndex: 1,
      isActive: 1,
    },
    {
      title: "Objection Handling Techniques",
      description: "Learn to handle common customer objections effectively.",
      category: "SalesTools" as const,
      contentType: "video" as const,
      contentUrl: "https://example.com/training/objection-handling",
      estimatedMinutes: 45,
      orderIndex: 2,
      isActive: 1,
    },
    {
      title: "Closing Strategies",
      description: "Master the art of closing deals with proven techniques.",
      category: "SalesTools" as const,
      contentType: "video" as const,
      contentUrl: "https://example.com/training/closing-strategies",
      estimatedMinutes: 40,
      orderIndex: 3,
      isActive: 1,
    },
  ];

  const insertedModules = await db.insert(trainingModules).values(trainingModuleData).returning();
  console.log(`✓ Created ${insertedModules.length} training modules`);

  // Create sample training progress for user (some completed, some in progress)
  const trainingProgressData = [
    {
      userId: user.id,
      moduleId: insertedModules[0].id, // DRM Intro - completed
      isCompleted: 1,
      progressPercent: 100,
      quizScore: 85,
      startedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
    },
    {
      userId: user.id,
      moduleId: insertedModules[1].id, // DRM Pipeline - in progress
      isCompleted: 0,
      progressPercent: 60,
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      userId: user.id,
      moduleId: insertedModules[3].id, // SEO Fundamentals - completed
      isCompleted: 1,
      progressPercent: 100,
      quizScore: 92,
      startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    },
    {
      userId: user.id,
      moduleId: insertedModules[6].id, // Alibaba Overview - in progress
      isCompleted: 0,
      progressPercent: 25,
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  ];

  await db.insert(trainingProgress).values(trainingProgressData);
  console.log(`✓ Created ${trainingProgressData.length} training progress records`);

  console.log("✅ Seeding completed successfully!");
}

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}

export { seed };
