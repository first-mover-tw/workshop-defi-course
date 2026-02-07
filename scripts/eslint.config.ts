import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default defineConfig([
  js.configs.recommended,

  globalIgnores([
    "node_modules/**",
    "dist/**",
    ".next/**",
    "out/**",
    "build/**",
    "src/db/generated/**",
    "bun.lockb",
  ]),

  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.node,
        Bun: "readonly",
      },
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },

    plugins: {
      // eslint-disable-next-line
      "@typescript-eslint": tsPlugin as any,
      prettier: prettierPlugin,
      import: importPlugin,
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "prettier/prettier": "warn",
      "no-console": "off",
    },
  },

  prettierConfig,
]);
