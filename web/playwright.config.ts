import { defineConfig, devices } from "@playwright/test";

const webBaseUrl = "http://127.0.0.1:3100";
const mockApiBaseUrl = "http://127.0.0.1:3101";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    [process.env.CI ? "line" : "list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: webBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/mock-api.mjs",
      reuseExistingServer: false,
      timeout: 30_000,
      url: `${mockApiBaseUrl}/__health`,
    },
    {
      command: "pnpm dev --hostname 127.0.0.1 --port 3100",
      env: {
        NATURE_LENS_E2E: "true",
        NEXT_PUBLIC_API_BASE_URL: mockApiBaseUrl,
        NEXT_PUBLIC_MAP_STYLE_URL: `${mockApiBaseUrl}/map/style.json`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: webBaseUrl,
    },
  ],
});
