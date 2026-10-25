import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import policy from "../../packages/eslint-config/index.js"; // [Sprints 7.1/7.19]: política «una librería por función» compartida (@aula/eslint-config)

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "no-restricted-imports": ["error", policy.next] } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
