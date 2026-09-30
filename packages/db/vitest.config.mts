import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Starting an embedded Postgres takes a while on a cold machine.
    testTimeout: 30_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
