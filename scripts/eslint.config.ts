import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default defineConfig([
  // 1. Core ESLint Recommended Rules
  js.configs.recommended,

  // 2. Global ignores (scorched-earth for generated/build files)
  globalIgnores([
    "node_modules/**",
    "dist/**",
    ".next/**",
    "out/**",
    "build/**",
    "src/db/generated/**", // Essential for Prisma 7
    "bun.lockb",
  ]),

  {
    // 3. Main TypeScript & Plugin configuration
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.node,
        // Add other globals if needed, like 'Bun' for the Bun runtime global
        Bun: "readonly",
      },
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin.configs,
      prettier: prettierPlugin,
      import: importPlugin,
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "off",

      // Prettier integration (shows prettier issues as ESLint warnings)
      "prettier/prettier": "warn",

      // General overrides
      "no-console": "off",
    },
  },

  // 4. Disable rules that conflict with Prettier (MUST BE LAST)
  prettierConfig,
]);
