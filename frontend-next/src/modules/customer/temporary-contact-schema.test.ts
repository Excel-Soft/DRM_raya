import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tempContactFormSchema } from "./temporary-contact-constants";

describe("temporary-contact schema", () => {
  it("requires title, name, email, mobile, source, grade", () => {
    const bad = tempContactFormSchema.safeParse({
      title: "",
      fullName: "ab",
      email: "bad",
      mobile: "123",
      source: "",
      grade: "",
      serviceTypes: [],
    });
    assert.equal(bad.success, false);

    const good = tempContactFormSchema.safeParse({
      title: "Mr",
      fullName: "John Doe",
      email: "john@example.com",
      mobile: "03001234567",
      source: "Website",
      grade: "A",
      serviceTypes: ["SEO & SEM Services"],
    });
    assert.equal(good.success, true);
  });
});
