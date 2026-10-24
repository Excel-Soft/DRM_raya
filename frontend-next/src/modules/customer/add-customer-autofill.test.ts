import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateAddCustomerTestData } from "./add-customer-autofill";
import { customerFormSchema } from "./add-customer-constants";

describe("generateAddCustomerTestData", () => {
  it("produces valid schema data with unique company name", () => {
    const a = generateAddCustomerTestData();
    const b = generateAddCustomerTestData();
    assert.notEqual(a.form.companyName, b.form.companyName);
    assert.equal(customerFormSchema.safeParse(a.form).success, true);
    assert.ok(a.form.email.includes("@"));
  });
});
