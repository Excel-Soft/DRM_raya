import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCreateUserPayload } from "./users-api";
import type { UserFormData } from "./add-user-schema";

describe("buildCreateUserPayload", () => {
  it("maps primary role and includes auto password", () => {
    const data: UserFormData = {
      firstName: "Sara",
      fatherHusbandName: "Khan",
      email: "sara@example.com",
      mobile: "3001112233",
      passportCnic: "123",
      dateOfBirth: "1995-05-05",
      joinDate: "2025-01-01",
      roleType: ["admin", "service_manager"],
      basicSalary: "100000",
      gender: "female",
    };
    const payload = buildCreateUserPayload(data);
    assert.equal(payload.role, "admin");
    assert.equal(payload.roleType, "admin");
    assert.deepEqual(payload.roles, ["admin", "service_manager"]);
    assert.equal(typeof payload.password, "string");
    assert.ok(payload.password.length >= 8);
  });
});
