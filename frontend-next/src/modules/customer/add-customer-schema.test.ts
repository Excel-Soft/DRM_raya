import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { customerFormSchema } from "./add-customer-constants";

describe("add-customer schema", () => {
  it("requires company, title, account holder, email, mobile", () => {
    const bad = customerFormSchema.safeParse({
      companyName: "A",
      country: "",
      title: "",
      accountName: "",
      email: "not-an-email",
      mobile: "",
    });
    assert.equal(bad.success, false);

    const good = customerFormSchema.safeParse({
      companyName: "Acme Corp",
      country: "Pakistan",
      title: "Mr",
      accountName: "Holder",
      email: "a@example.com",
      mobile: "03001234567",
    });
    assert.equal(good.success, true);
  });
});
