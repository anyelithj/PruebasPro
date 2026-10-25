// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import policy from '../../packages/eslint-config/index.js'; // [Sprints 7.1/7.19]: política «una librería por función» compartida (@aula/eslint-config)

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
      // [Política de dependencias · Sprint 7.19 · RNF-32]: una librería por función (informe, «Política de dependencias»)
      'no-restricted-imports': ['error', policy.nest],
    },
  },
  {
    // [Excepción documentada]: el id_token de Microsoft se valida contra sus claves públicas remotas (JWKS); @nestjs/jwt no las descarga
    files: ['src/modules/auth/infrastructure/services/microsoft-oauth.verifier.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
