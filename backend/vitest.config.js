import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    environment: "node",
    setupFiles: ["tests/setupEnv.js"],
    hookTimeout: 30000,
    testTimeout: 30000,
    sequence: { concurrent: false },
    fileParallelism: false
  }
});
