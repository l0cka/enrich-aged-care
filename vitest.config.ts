import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    coverage: {
      include: ["lib/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html"],
    },
    exclude: ["**/node_modules/**", "tests/e2e/**"],
    include: ["tests/unit/**/*.test.ts"],
  },
});
