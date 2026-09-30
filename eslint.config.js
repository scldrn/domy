import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/test-results/",
      "**/playwright-report/",
      "apps/web/src/route-tree.gen.ts",
      "apps/server/src/db/migrations/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-ignore": true }],
      // TanStack Router redirects and not-found results are thrown by design.
      "@typescript-eslint/only-throw-error": [
        "error",
        {
          allow: [
            {
              from: "package",
              package: "@tanstack/router-core",
              name: ["Redirect", "NotFoundError"],
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
