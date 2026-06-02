import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../db";
import {
  allowedIps,
  customers,
  customerContacts,
  permissions,
  policies,
  projectAssignments,
  projects,
  rolePermissions,
  roles,
  supportMessages,
  supportTickets,
  tasks,
  users,
} from "../db/schema";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function upsertRole(name: string, description: string | null) {
  const now = new Date();
  const [row] = await db
    .insert(roles)
    .values({
      name,
      description,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: roles.name,
      set: { description, updated_at: now },
    })
    .returning({ id: roles.id, name: roles.name });
  return row;
}

async function upsertPermission(module: string, action: string, description: string | null) {
  const now = new Date();
  const [row] = await db
    .insert(permissions)
    .values({
      module,
      action,
      description,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [permissions.module, permissions.action],
      set: { description, updated_at: now },
    })
    .returning({
      id: permissions.id,
      module: permissions.module,
      action: permissions.action,
    });
  return row;
}

async function main() {
  const now = new Date();

  const [adminRole, managerRole, salesRole, supportRole, accountantRole, superHodRole, hodRole, serviceManagerRole, developerRole, salesManagerRole, salesAssistantManagerRole, accountManagerRole] =
    await Promise.all([
      upsertRole("admin", "System administrator"),
      upsertRole("manager", "Manager"),
      upsertRole("sales_executive", "Sales executive"),
      upsertRole("support_agent", "Support agent"),
      upsertRole("accountant", "Accounts / finance"),
      upsertRole("super_hod", "Senior Head of Department"),
      upsertRole("hod", "Head of Department"),
      upsertRole("service_manager", "Service and administration management"),
      upsertRole("developer", "Software developer"),
      upsertRole("sales_manager", "Sales manager"),
      upsertRole("sales_assistant_manager", "Sales assistant manager"),
      upsertRole("account_manager", "Account manager"),
    ]);

  const basePermissions = await Promise.all([
    upsertPermission("customers", "read", "Read customers"),
    upsertPermission("customers", "write", "Create/update customers"),
    upsertPermission("opportunities", "read", "Read opportunities"),
    upsertPermission("opportunities", "write", "Create/update opportunities"),
    upsertPermission("projects", "read", "Read projects"),
    upsertPermission("projects", "write", "Create/update projects"),
    upsertPermission("tasks", "read", "Read tasks"),
    upsertPermission("tasks", "write", "Create/update tasks"),
    upsertPermission("support", "read", "Read support tickets/messages"),
    upsertPermission("support", "write", "Create/update support tickets/messages"),
    upsertPermission("accounts", "read", "Read invoices/ledger"),
    upsertPermission("accounts", "write", "Create/update invoices/ledger"),
    upsertPermission("settings", "read", "Read settings/policies"),
    upsertPermission("settings", "write", "Update settings/policies"),
    upsertPermission("hr", "read", "Read HR data"),
    upsertPermission("hr", "write", "Update HR data"),
    upsertPermission("training", "read", "Read training materials"),
    upsertPermission("training", "write", "Update training materials"),
    upsertPermission("reports", "read", "Read reports"),
    upsertPermission("office", "read", "Read office accounts"),
    upsertPermission("office", "write", "Update office accounts"),
  ]);

  // Role → permissions mapping (example defaults; change as needed)
  const roleToPermissionNames: Record<string, Array<[string, string]>> = {
    [adminRole.name]: (basePermissions as any[])
      .filter((p) => !!p && typeof p === 'object' && 'module' in p && 'action' in p)
      .map((p) => [p.module, p.action]),
    [managerRole.name]: [
      ["customers", "read"],
      ["customers", "write"],
      ["opportunities", "read"],
      ["opportunities", "write"],
      ["projects", "read"],
      ["projects", "write"],
      ["tasks", "read"],
      ["tasks", "write"],
      ["support", "read"],
    ],
    [superHodRole.name]: [
      ["customers", "read"],
      ["opportunities", "read"],
      ["projects", "read"],
      ["tasks", "read"],
      ["tasks", "write"],
      ["hr", "read"],
      ["hr", "write"],
      ["training", "read"],
      ["training", "write"],
    ],
    [hodRole.name]: [
      ["customers", "read"],
      ["opportunities", "read"],
      ["tasks", "read"],
      ["tasks", "write"],
      ["hr", "read"],
    ],
    [serviceManagerRole.name]: [
      ["customers", "read"],
      ["tasks", "read"],
      ["tasks", "write"],
      ["support", "read"],
      ["support", "write"],
    ],
    [salesRole.name]: (basePermissions as any[])
      .filter((p) => {
        const validModules = ["customers", "opportunities", "tasks"];
        return !!p && typeof p === 'object' && 'module' in p && 'action' in p && validModules.includes(p.module);
      })
      .map((p) => [p.module, p.action]),
    [supportRole.name]: [
      ["support", "read"],
      ["support", "write"],
      ["customers", "read"],
    ],
    [accountantRole.name]: [
      ["accounts", "read"],
      ["accounts", "write"],
    ],
    [developerRole.name]: [
      ["customers", "read"],
      ["projects", "read"],
      ["projects", "write"],
      ["tasks", "read"],
      ["tasks", "write"],
    ],
    [salesManagerRole.name]: [
      ["customers", "read"],
      ["customers", "write"],
      ["opportunities", "read"],
      ["opportunities", "write"],
      ["projects", "read"],
      ["tasks", "read"],
      ["tasks", "write"],
      ["reports", "read"],
    ],
    [salesAssistantManagerRole.name]: [
      ["customers", "read"],
      ["customers", "write"],
      ["opportunities", "read"],
      ["opportunities", "write"],
      ["tasks", "read"],
      ["tasks", "write"],
    ],
    [accountManagerRole.name]: [
      ["customers", "read"],
      ["customers", "write"],
      ["accounts", "read"],
      ["accounts", "write"],
      ["projects", "read"],
    ],
  };

  const roleIdByName = new Map<string, string>(
    [adminRole, managerRole, salesRole, supportRole, accountantRole, superHodRole, hodRole, serviceManagerRole, developerRole, salesManagerRole, salesAssistantManagerRole, accountManagerRole]
      .filter((r): r is { id: string; name: string } => !!r)
      .map((r) => [r.name, r.id]),
  );
  const permissionIdByKey = new Map<string, string>(
    basePermissions
      .filter((p): p is { id: string; module: string; action: string } => !!p)
      .map((p) => [`${p.module}:${p.action}`, p.id]),
  );

  for (const [roleName, permissionPairs] of Object.entries(roleToPermissionNames)) {
    const roleId = roleIdByName.get(roleName);
    if (!roleId) continue;

    for (const [module, action] of permissionPairs) {
      const permissionId = permissionIdByKey.get(`${module}:${action}`);
      if (!permissionId) continue;

      await db
        .insert(rolePermissions)
        .values({
          role_id: roleId,
          permission_id: permissionId,
          updated_at: now,
        })
        .onConflictDoNothing({
          target: [rolePermissions.role_id, rolePermissions.permission_id],
        });
    }
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const adminPasswordHash = `sha256:${sha256(adminPassword)}`;

  const [adminUser] = await db
    .insert(users)
    .values({
      full_name: "Admin User",
      email: adminEmail,
      password_hash: adminPasswordHash,
      role: "admin",
      is_active: true,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        full_name: "Admin User",
        role: "admin",
        is_active: true,
        password_hash: adminPasswordHash,
        updated_at: now,
      },
    })
    .returning({ id: users.id, email: users.email });

  await db
    .insert(policies)
    .values({
      key: "ip_restriction_enabled",
      value_json: { enabled: false },
      description: "Enable/disable IP allowlist checks",
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: policies.key,
      set: {
        value_json: { enabled: false },
        description: "Enable/disable IP allowlist checks",
        updated_at: now,
      },
    });

  await db
    .insert(policies)
    .values({
      key: "system_locations",
      value_json: {
        branches: ["Lahore Gulburg", "Lahore Raya", "Sialkot Welc", "Sialkot webexcels", "Gugrawala webexcels", "Faislabad webexcels"],
        countries: ["UAE", "USA", "Pakistan"],
      },
      description: "Master list of Branches and Countries",
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: policies.key,
      set: {
        value_json: {
          branches: ["Lahore Gulburg", "Lahore Raya", "Sialkot Welc", "Sialkot webexcels", "Gugrawala webexcels", "Faislabad webexcels"],
          countries: ["UAE", "USA", "Pakistan"],
        },
        description: "Master list of Branches and Countries",
        updated_at: now,
      },
    });

  // Example allowlist entry (disabled by default)
  const allowAllCidr = "0.0.0.0/0";
  const existingAllowAll = await db
    .select({ id: allowedIps.id })
    .from(allowedIps)
    .where(and(eq(allowedIps.ip_cidr, allowAllCidr), eq(allowedIps.is_active, false)))
    .limit(1);

  if (existingAllowAll.length === 0) {
    await db.insert(allowedIps).values({
      ip_cidr: allowAllCidr,
      description: "Dev default (disabled)",
      is_active: false,
      updated_at: now,
    });
  }

  // Minimal demo data (kept small; safe to remove)
  const demoCompany = "Acme Corp";
  const existingCustomer = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.company_name, demoCompany), eq(customers.is_deleted, false)))
    .limit(1);

  const customerId =
    existingCustomer[0]?.id ??
    (
      await db
        .insert(customers)
        .values({
          company_name: demoCompany,
          country: "UAE",
          city: "Dubai",
          status: "New",
          source: "Seed",
          created_by: adminUser.id,
          updated_at: now,
        })
        .returning({ id: customers.id })
    )[0].id;

  const contactEmail = "accounts@acme.example";
  const existingContact = await db
    .select({ id: customerContacts.id })
    .from(customerContacts)
    .where(eq(customerContacts.email, contactEmail))
    .limit(1);

  if (existingContact.length === 0) {
    await db.insert(customerContacts).values({
      customer_id: customerId,
      is_primary: true,
      account_holder_name: "Acme Accounts",
      person_name: "Jane Doe",
      email: contactEmail,
      phone: "+971500000000",
      updated_at: now,
    });
  }

  const demoProjectName = "Website Revamp";
  const existingProject = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.name, demoProjectName), eq(projects.is_deleted, false)))
    .limit(1);

  const projectId =
    existingProject[0]?.id ??
    (
      await db
        .insert(projects)
        .values({
          customer_id: customerId,
          name: demoProjectName,
          status: "Active",
          created_by: adminUser.id,
          updated_at: now,
        })
        .returning({ id: projects.id })
    )[0].id;

  await db
    .insert(projectAssignments)
    .values({
      project_id: projectId,
      user_id: adminUser.id,
      role: "owner",
      assigned_at: now,
      updated_at: now,
    })
    .onConflictDoNothing({
      target: [projectAssignments.project_id, projectAssignments.user_id],
    });

  const demoTaskTitle = "Kickoff meeting";
  const existingTask = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.project_id, projectId), eq(tasks.title, demoTaskTitle)))
    .limit(1);

  if (existingTask.length === 0) {
    await db.insert(tasks).values({
      project_id: projectId,
      title: demoTaskTitle,
      status: "ToDo",
      priority: "High",
      created_by: adminUser.id,
      updated_at: now,
    });
  }

  const demoTicketSubject = "Demo support ticket";
  const existingTicket = await db
    .select({ id: supportTickets.id })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.subject, demoTicketSubject),
        eq(supportTickets.is_deleted, false),
      ),
    )
    .limit(1);

  const ticketId =
    existingTicket[0]?.id ??
    (
      await db
        .insert(supportTickets)
        .values({
          customer_id: customerId,
          created_by: adminUser.id,
          subject: demoTicketSubject,
          status: "Open",
          priority: "Low",
          channel: "web",
          updated_at: now,
        })
        .returning({ id: supportTickets.id })
    )[0].id;

  const existingMsg = await db
    .select({ id: supportMessages.id })
    .from(supportMessages)
    .where(eq(supportMessages.ticket_id, ticketId))
    .limit(1);

  if (existingMsg.length === 0) {
    await db.insert(supportMessages).values({
      ticket_id: ticketId,
      sender_user_id: adminUser.id,
      message: "Seeded message: ticket created successfully.",
      updated_at: now,
    });
  }

  console.log("Seed complete:", {
    adminEmail,
    customer: demoCompany,
    project: demoProjectName,
  });
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

