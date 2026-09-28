import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: ["packages/web/**/*.{js,jsx,ts,tsx}"],
    rules: {
      // Keep advisory React Compiler diagnostics visible without making them blockers.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: ["packages/server/**/*.{js,ts,cjs}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["packages/server/src/**/*.ts"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    "**/.next/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/next-env.d.ts",
  ]),
]);
