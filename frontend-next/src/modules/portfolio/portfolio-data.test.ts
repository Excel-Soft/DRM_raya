import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePortfolioRow,
  parsePortfolioList,
  portfolioDisplayTitle,
  portfolioImageSrc,
} from "./portfolio-data";

describe("portfolio-data", () => {
  it("normalizes snake_case API rows", () => {
    const row = normalizePortfolioRow({
      id: "abc",
      keyword: "Sports",
      main_category: "Website",
      sub_category: "Minisite",
      server_link: "https://example.com",
      top_header_image: "/uploads/portfolio/a.png",
      full_image: "",
      sliders: ["/uploads/portfolio/b.png"],
      created_at: "2025-07-22T00:00:00.000Z",
    });
    assert.ok(row);
    assert.equal(row!.mainCategory, "Website");
    assert.equal(portfolioImageSrc(row!), "/uploads/portfolio/a.png");
    assert.equal(portfolioDisplayTitle(row!), "Sports");
  });

  it("falls back thumbnail and title from link", () => {
    const row = normalizePortfolioRow({
      id: "x",
      server_link: "shop.example.com",
      body_image: "/uploads/portfolio/body.jpg",
    });
    assert.ok(row);
    assert.equal(portfolioImageSrc(row!), "/uploads/portfolio/body.jpg");
    assert.equal(portfolioDisplayTitle(row!), "shop.example.com");
  });

  it("parsePortfolioList accepts array or { data }", () => {
    const list = parsePortfolioList({ data: [{ id: "1", keyword: "A" }] });
    assert.equal(list.length, 1);
    assert.equal(list[0]!.keyword, "A");
  });
});
