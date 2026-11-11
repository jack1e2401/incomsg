import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "ux-flow.spec.ts",
  fullyParallel: false,
  reporter: "list",
  timeout: 20_000,
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5197" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    cwd: fileURLToPath(new URL("../../apps/frontend/", import.meta.url)),
    command: "npm run dev -- --host 127.0.0.1 --port 5197 --strictPort",
    url: "http://127.0.0.1:5197",
    reuseExistingServer: false,
    timeout: 30_000,
    env: { VITE_PAYMENT_MODE: "vnpay" },
  },
});
