import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "milestone2.spec.ts",
  fullyParallel: false,
  reporter: "list",
  timeout: 25_000,
  use: { baseURL: "http://127.0.0.1:5175", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    cwd: fileURLToPath(new URL("../../apps/frontend/", import.meta.url)),
    command: "npm run dev -- --host 127.0.0.1 --port 5175 --strictPort",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: false,
    timeout: 30_000,
    env: { VITE_API_BASE_URL: "http://localhost:3000" },
  },
});
