import "../utils/env";
import { db } from "../db";
import { users } from "../../shared/schema";
import { createHash } from "node:crypto";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function createTestUser() {
  const email = "executive@webexcels.com";
  const password = "123";
  const role = "product_posting_executive";
  const passwordHash = `sha256:${sha256(password)}`;

  console.log(`Creating test user: ${email} with role: ${role}`);

  try {
    await db.insert(users).values({
      name: "Test Executive",
      fullName: "Test Executive",
      username: "executive_test",
      email,
      password: password, // Original schema has both password and password_hash sometimes? Let's check shared/schema.ts
      passwordHash,
      role,
      roleId: role,
      roles: [role],
      isActive: true,
      branch: "Lahore Gulburg",
      country: "Pakistan",
    }).onConflictDoUpdate({
      target: users.email,
      set: {
        role,
        roleId: role,
        roles: [role],
        passwordHash,
        password: password,
      }
    });
    console.log("Test user created/updated successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to create test user:", err);
    process.exit(1);
  }
}

createTestUser();
