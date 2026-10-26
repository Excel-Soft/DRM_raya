import { defineConfig, devices } from "@playwright/test";

/** Phase 5 default: standalone on :3001 (override with PLAYWRIGHT_BASE_URL). */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Prefer system Chrome when Playwright-managed Chromium is unavailable (e.g. older macOS).
        channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
      },
    },
  ],
});
