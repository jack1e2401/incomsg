import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./playwright",
  testMatch: "milestone2.spec.ts",
  fullyParallel: false,
  reporter: "list",
  timeout: 25_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5174",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      VITE_API_MODE: "http",
      VITE_API_BASE_URL: "http://localhost:3000",
    },
  },
});
