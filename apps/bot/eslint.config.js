import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Type-checked rules we actively enforce
      "@typescript-eslint/no-floating-promises": "error",
      // Discord.js event handlers pass async callbacks to void-typed args — allow
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false } },
      ],
      "@typescript-eslint/await-thenable": "error",

      // Relaxed rules for this codebase
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-require-imports": "off",
      // Prisma emulation uses declaration merging — expected pattern
      "@typescript-eslint/no-unsafe-declaration-merging": "off",
      "@typescript-eslint/no-empty-object-type": "off",

      "no-console": "off",

      // Import order kept as warning
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },
  {
    ignores: [
      "dist",
      "node_modules",
      "*.js",
      "*.cjs",
      "scripts/**",
      "test/**",
      "vitest.config.ts",
      "src/tests/**",
    ],
  },
);
