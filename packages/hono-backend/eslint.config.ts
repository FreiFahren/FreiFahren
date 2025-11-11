import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import preferArrowPlugin from "eslint-plugin-prefer-arrow";
import tseslint from "typescript-eslint";

export default [
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      import: importPlugin,
      "prefer-arrow": preferArrowPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import/no-unresolved": "warn",
      "import/no-unused-modules": "warn",
      "no-console": "warn",
      "no-duplicate-imports": "warn",
      "no-use-before-define": "warn",
      "no-useless-assignment": "warn",
      "capitalized-comments": "warn",
      "no-bitwise": "warn",
      eqeqeq: "error",
      "no-empty-function": "error",
      "no-eq-null": "error",
      "no-lonely-if": "warn",
      "no-nested-ternary": "warn",
      "no-redeclare": "error",
      "no-useless-catch": "error",
      "no-var": "warn",
      "prefer-const": "warn",
      "max-depth": ["error", 4],
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowNumber: false,
        },
      ],
      "prefer-arrow/prefer-arrow-functions": [
        "error",
        {
          disallowPrototype: true,
        },
      ],
      complexity: ["error"],
    },
  },
  {
    ignores: ["node_modules/**", "dist/**", "build/**"],
  },
];
