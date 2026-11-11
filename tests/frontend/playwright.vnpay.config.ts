import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "vnpay.spec.ts",
  fullyParallel: false,
  reporter: "list",
  timeout: 30_000,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5194" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    cwd: fileURLToPath(new URL("../../apps/frontend/", import.meta.url)),
    command: "npm run dev -- --host 127.0.0.1 --port 5194 --strictPort",
    url: "http://127.0.0.1:5194",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { VITE_API_BASE_URL: "http://localhost:3000", VITE_API_MODE: "http", VITE_PAYMENT_MODE: "vnpay" },
  },
});
