import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.property.test.ts", "src/index.ts"],
      thresholds: {
        branches: 70,
        functions: 75,
        lines: 75,
      },
    },
  },
})
