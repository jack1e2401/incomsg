import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  testMatch: "commerce-http.spec.ts",
  fullyParallel: false,
  reporter: "list",
  timeout: 25_000,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5193" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5193 --strictPort",
    url: "http://127.0.0.1:5193",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { VITE_API_BASE_URL: "http://localhost:3000", VITE_PAYMENT_MODE: "mock" },
  },
});
