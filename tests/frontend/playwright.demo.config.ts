import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "demo-mode.spec.ts",
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5195" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    cwd: fileURLToPath(new URL("../../apps/frontend/", import.meta.url)),
    command: "npm run dev -- --host 127.0.0.1 --port 5195 --strictPort",
    url: "http://127.0.0.1:5195",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: { VITE_API_MODE: "mock", VITE_PAYMENT_MODE: "mock" },
  },
});
