import { insertRoleSchema } from "./shared/schema";

try {
    const result = insertRoleSchema.parse({ name: "test_role", description: "test" });
    console.log("Validation success:", result);
} catch (e: any) {
    console.error("Validation failed:", e.errors || e.message);
}
