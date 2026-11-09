import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  testMatch: "demo-mode.spec.ts",
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5195" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `"${process.execPath}" node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5195 --strictPort`,
    url: "http://127.0.0.1:5195",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { VITE_API_MODE: "mock", VITE_PAYMENT_MODE: "mock" },
  },
});
