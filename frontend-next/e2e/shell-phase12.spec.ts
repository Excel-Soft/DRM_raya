import { test, expect } from "@playwright/test";

/** Unauthenticated layout smoke — viewports (Phase 12). App shell/theme toggle requires login. */
test.describe("shell layout smoke", () => {
  test("auth page renders at mobile, tablet, desktop widths", async ({ page }) => {
    for (const width of [375, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/auth");
      await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollW).toBeLessThanOrEqual(clientW + 1);
    }
  });
});
