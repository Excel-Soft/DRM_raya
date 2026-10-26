import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { userFormSchema } from "./add-user-schema";

const validBase = {
  firstName: "Ali",
  fatherHusbandName: "Ahmed",
  email: "ali@example.com",
  mobile: "3001234567",
  passportCnic: "3520212345671",
  dateOfBirth: "1990-01-01",
  joinDate: "2024-01-01",
  roleType: ["sales_executive"],
  basicSalary: "50000",
  gender: "male",
};

describe("add-user-schema", () => {
  it("accepts a minimal valid payload", () => {
    const result = userFormSchema.safeParse(validBase);
    assert.equal(result.success, true);
  });

  it("rejects invalid email", () => {
    const result = userFormSchema.safeParse({ ...validBase, email: "not-an-email" });
    assert.equal(result.success, false);
  });

  it("requires at least one role", () => {
    const result = userFormSchema.safeParse({ ...validBase, roleType: [] });
    assert.equal(result.success, false);
  });

  it("rejects non-numeric mobile", () => {
    const result = userFormSchema.safeParse({ ...validBase, mobile: "abc" });
    assert.equal(result.success, false);
  });
});
