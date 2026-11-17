import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import storybook from 'eslint-plugin-storybook'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'storybook-static', 'coverage', '.storybook/**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended, // accesibilidad: etiquetas, roles, foco, etc.
  ...storybook.configs['flat/recommended'],
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
  },
  {
    files: ['*.config.{js,cjs,ts}', 'jest.config.cjs', 'scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier, // al final: desactiva reglas de estilo que choquen con Prettier
)
