import { db } from "./db";
import { roles, urlPermissions, policies, allowedIps } from "@shared/schema";
import { usersRepository } from "./repositories/users.repository";

export async function seedSettings() {
  console.log("🌱 Seeding Settings data...");

  // Get first user for createdByUserId references
  const firstUser = await usersRepository.findByEmail("john.doe@webexcels.com");
  if (!firstUser) {
    console.error("❌ No users found in database. Please run main seed first.");
    return;
  }

  // ========================================
  // Seed Roles
  // ========================================
  const roleData = [
    {
      name: "sales_executive",
      description: "Sales Executive - Front-line sales team member",
    },
    {
      name: "assistant_manager",
      description: "Assistant Manager - Supports team management and operations",
    },
    {
      name: "manager",
      description: "Manager - Manages team performance and strategy",
    },
    {
      name: "hod",
      description: "Head of Department - Oversees departmental operations",
    },
    {
      name: "admin",
      description: "Administrator - Full system access and configuration",
    },
  ];

  console.log("  📋 Seeding roles...");
  for (const roleItem of roleData) {
    await db
      .insert(roles)
      .values(roleItem)
      .onConflictDoUpdate({
        target: roles.name,
        set: { description: roleItem.description },
      });
  }
  console.log(`  ✅ Seeded ${roleData.length} roles`);

  // ========================================
  // Seed URL Permissions
  // ========================================
  // Note: allowedRoleIds uses role names (matching users.roleId field)
  // Paths should match actual API routes (including /api prefix for backend routes)
  const urlPermissionData = [
    {
      path: "/api/sales",
      name: "Sales Module API",
      allowedRoleIds: ["sales_executive", "assistant_manager", "manager", "hod", "admin"],
      subUrls: null,
    },
    {
      path: "/api/pms",
      name: "PMS Module API",
      allowedRoleIds: ["sales_executive", "assistant_manager", "manager", "hod", "admin"],
      subUrls: null,
    },
    {
      path: "/api/support",
      name: "Support Module API",
      allowedRoleIds: ["sales_executive", "assistant_manager", "manager", "hod", "admin"],
      subUrls: null,
    },
    {
      path: "/api/settings",
      name: "Settings Module API",
      allowedRoleIds: ["admin"],
      subUrls: null,
    },
  ];

  console.log("  🔒 Seeding URL permissions...");
  for (const permissionItem of urlPermissionData) {
    await db
      .insert(urlPermissions)
      .values(permissionItem)
      .onConflictDoUpdate({
        target: urlPermissions.path,
        set: {
          name: permissionItem.name,
          allowedRoleIds: permissionItem.allowedRoleIds,
          subUrls: permissionItem.subUrls,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`  ✅ Seeded ${urlPermissionData.length} URL permissions`);

  // ========================================
  // Seed Policies
  // ========================================
  const policyData = [
    {
      key: "monthly_time",
      title: "Monthly Working Time Requirement",
      contentHtml: `
        <h3>Monthly Working Time Policy</h3>
        <p>All employees are required to maintain a minimum monthly working time as specified by their role and contract.</p>
        <ul>
          <li>Minimum: 160 hours (equivalent to ~8 hours/day for 20 working days)</li>
          <li>Maximum: 200 hours (to ensure work-life balance)</li>
        </ul>
        <p><strong>Tracking:</strong> Time is automatically tracked through the attendance system.</p>
        <p><strong>Exceptions:</strong> Approved leaves and public holidays are excluded from calculations.</p>
      `,
      type: "numericRange" as const,
      minValue: 160,
      maxValue: 200,
    },
    {
      key: "monthly_leave",
      title: "Monthly Leave Allowance",
      contentHtml: `
        <h3>Monthly Leave Policy</h3>
        <p>Employees are entitled to a specific number of leave days per month, subject to approval.</p>
        <ul>
          <li>Minimum: 0 days (no mandatory leave)</li>
          <li>Maximum: 2 days per month (casual/sick leave combined)</li>
        </ul>
        <p><strong>Annual Accrual:</strong> Unused monthly leave may accrue up to 24 days annually.</p>
        <p><strong>Approval Process:</strong> All leave requests must be submitted 48 hours in advance for approval.</p>
      `,
      type: "numericRange" as const,
      minValue: 0,
      maxValue: 2,
    },
    {
      key: "data_privacy",
      title: "Data Privacy and Confidentiality",
      contentHtml: `
        <h3>Data Privacy Policy</h3>
        <p>All employees must maintain strict confidentiality regarding customer data, sales information, and internal business processes.</p>
        <h4>Key Principles:</h4>
        <ul>
          <li>Customer data must never be shared outside authorized systems</li>
          <li>Access to sensitive information is role-based and logged</li>
          <li>Personal devices must not be used to store company data</li>
          <li>Data breaches must be reported immediately to IT and management</li>
        </ul>
        <h4>Consequences:</h4>
        <p>Violation of data privacy policies may result in disciplinary action, including termination and legal proceedings.</p>
      `,
      type: "text" as const,
      minValue: null,
      maxValue: null,
    },
    {
      key: "code_of_conduct",
      title: "Employee Code of Conduct",
      contentHtml: `
        <h3>Code of Conduct</h3>
        <p>All employees are expected to maintain professional standards in the workplace.</p>
        <h4>Expected Behaviors:</h4>
        <ul>
          <li>Treat colleagues, customers, and partners with respect</li>
          <li>Maintain punctuality and professional appearance</li>
          <li>Follow company policies and procedures</li>
          <li>Report misconduct or policy violations</li>
        </ul>
        <h4>Prohibited Behaviors:</h4>
        <ul>
          <li>Harassment, discrimination, or bullying</li>
          <li>Unauthorized use of company resources</li>
          <li>Conflicts of interest without disclosure</li>
          <li>Substance abuse in the workplace</li>
        </ul>
      `,
      type: "text" as const,
      minValue: null,
      maxValue: null,
    },
    {
      key: "sales_targets",
      title: "Sales Target Achievement Policy",
      contentHtml: `
        <h3>Sales Targets and Performance</h3>
        <p>Sales executives are assigned monthly and quarterly targets based on business objectives.</p>
        <h4>Target Setting:</h4>
        <ul>
          <li>Targets are set at the beginning of each quarter</li>
          <li>Regular reviews and adjustments based on market conditions</li>
          <li>Clear KPIs: AB (Annual Business), VAS (Value Added Services)</li>
        </ul>
        <h4>Performance Evaluation:</h4>
        <ul>
          <li>Monthly performance reviews with direct manager</li>
          <li>Bonus and incentives tied to target achievement</li>
          <li>Underperformance support and improvement plans</li>
        </ul>
      `,
      type: "text" as const,
      minValue: null,
      maxValue: null,
    },
  ];

  console.log("  📜 Seeding policies...");
  for (const policyItem of policyData) {
    await db
      .insert(policies)
      .values({
        key: policyItem.key,
        value_json: {
          title: policyItem.title,
          contentHtml: policyItem.contentHtml,
          type: policyItem.type,
          minValue: policyItem.minValue,
          maxValue: policyItem.maxValue,
        },
        description: policyItem.title,
      })
      .onConflictDoUpdate({
        target: policies.key,
        set: {
          value_json: {
            title: policyItem.title,
            contentHtml: policyItem.contentHtml,
            type: policyItem.type,
            minValue: policyItem.minValue,
            maxValue: policyItem.maxValue,
          },
          description: policyItem.title,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`  ✅ Seeded ${policyData.length} policies`);

  // ========================================
  // Seed Allowed IPs
  // ========================================
  const allowedIpData = [
    {
      ip_cidr: "192.168.1.100",
      description: "HQ Office - Dubai (Chrome 120, Office Network)",
      is_active: true,
    },
    {
      ip_cidr: "192.168.1.101",
      description: "HQ Office - Dubai (Firefox 121, Office Network)",
      is_active: true,
    },
    {
      ip_cidr: "10.0.0.50",
      description: "Branch Office - Abu Dhabi (Safari 17, Branch Network)",
      is_active: true,
    },
    {
      ip_cidr: "203.0.113.45",
      description: "Remote Worker - John Doe (Chrome 120, john.doe@webexcels.com)",
      is_active: true,
    },
    {
      ip_cidr: "198.51.100.78",
      description: "Remote Worker - Jane Smith (Edge 120, jane.smith@webexcels.com)",
      is_active: true,
    },
  ];

  console.log("  🌐 Seeding allowed IPs...");
  for (const ipItem of allowedIpData) {
    await db
      .insert(allowedIps)
      .values(ipItem)
      .onConflictDoUpdate({
        target: allowedIps.ip_cidr,
        set: {
          description: ipItem.description,
          is_active: ipItem.is_active,
          updatedAt: new Date(),
        },
      });
  }
  console.log(`  ✅ Seeded ${allowedIpData.length} allowed IPs`);

  console.log("✅ Settings data seeding completed!");
}

// Run if called directly
seedSettings()
  .then(() => {
    console.log("Seeding finished successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
