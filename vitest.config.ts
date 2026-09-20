import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/*.test.ts"],
    // Account and recovery cases intentionally exercise password hashing. Give
    // them enough room when all backend suites compete for CPU in CI.
    testTimeout: 15_000,
    server: { deps: { inline: ["convex-test"] } },
  },
});
