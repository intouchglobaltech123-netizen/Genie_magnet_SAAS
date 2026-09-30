import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC keeps decorator metadata, which Nest's dependency injection needs.
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    testTimeout: 30_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
