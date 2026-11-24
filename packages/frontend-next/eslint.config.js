import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import reactCompiler from 'eslint-plugin-react-compiler';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import pluginQuery from '@tanstack/eslint-plugin-query';
import pluginRouter from '@tanstack/eslint-plugin-router';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier/flat';
import compat from 'eslint-plugin-compat';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['dist', 'ios', 'src/routeTree.gen.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactCompiler.configs.recommended,
      jsxA11y.flatConfigs.recommended,
      pluginQuery.configs['flat/recommended'],
      pluginRouter.configs['flat/recommended'],
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-refresh': reactRefresh,
    },
    rules: {
      'no-nested-ternary': 'error',
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['Route'] },
      ],
    },
  },
  {
    // Vite lowers syntax, not missing APIs. Keep browser-only checks off Node build/config code.
    files: ['src/**/*.{ts,tsx}'],
    plugins: { compat },
    settings: { lintAllEsApis: true },
    rules: {
      'compat/compat': 'error',
      // The compatibility plugin misses these static methods; TypeScript's DOM types allow
      // them even though Safari 15/Chromium 99 do not. Keep the fetchFund controller fallback.
      'no-restricted-properties': [
        'error',
        {
          object: 'AbortSignal',
          property: 'timeout',
          message: 'Use AbortController and a timer for Safari 15/older Chromium compatibility.',
        },
        {
          object: 'AbortSignal',
          property: 'any',
          message: 'Use AbortController with abort listeners for our older-browser floor.',
        },
      ],
    },
  },
  {
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
]);
