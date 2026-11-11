import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import frontendConfig from "../../apps/frontend/vite.config.ts";

export default mergeConfig(
  frontendConfig,
  defineConfig({
    root: fileURLToPath(new URL("../../", import.meta.url)),
    envDir: fileURLToPath(new URL("../../apps/frontend/", import.meta.url)),
    test: { include: ["tests/frontend/unit/**/*.test.ts", "tests/frontend/unit/**/*.test.tsx"] },
  }),
);
