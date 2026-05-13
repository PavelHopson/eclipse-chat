import { defineConfig } from "vitest/config";

/**
 * Vitest config — server-side unit tests.
 * Тесты НЕ требуют DB или HTTP сервера — это pure unit tests
 * для tokenizer'ов, validators, business logic helpers.
 *
 * Integration tests с PG / supertest — отдельный target, отложен.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    testTimeout: 5000,
  },
});
