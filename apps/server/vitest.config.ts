import { configDefaults, defineConfig } from "vitest/config";

// T107: capacity keeps its original budgets, without competing with unrelated DB fixtures.
const capacityFiles = ["tests/*-scale.test.ts", "tests/routes-invariants.test.ts"];

export default defineConfig({
  test: {
    hookTimeout: 120_000,
    testTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: "integration",
          include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...capacityFiles],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "capacity",
          include: capacityFiles,
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
