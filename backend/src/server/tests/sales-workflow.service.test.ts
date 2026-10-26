import { describe, it, expect } from "vitest";
import { isGmCatalogProductName } from "../../shared/gm-package-catalog";
import {
  classifyDownstreamFromLineLabels,
  FOLLOWUP_ELIGIBILITY_DAYS,
} from "../services/sales-workflow.service";

describe("sales-workflow catalog", () => {
  it("classifies GM catalog names", () => {
    expect(isGmCatalogProductName("Basic Plus")).toBe(true);
    expect(isGmCatalogProductName("Basic Plus with price label 1999")).toBe(true);
    expect(isGmCatalogProductName("Domain Registration")).toBe(false);
  });

  it("routes approved quotation lines to gm vs invoice", () => {
    expect(classifyDownstreamFromLineLabels(["Basic Plus with price label 1999"])).toBe("gm");
    expect(classifyDownstreamFromLineLabels(["Domain Registration"])).toBe("invoice");
  });

  it("uses 60-day eligibility window", () => {
    expect(FOLLOWUP_ELIGIBILITY_DAYS).toBe(60);
  });
});
