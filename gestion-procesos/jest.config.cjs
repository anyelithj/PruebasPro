/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  setupFiles: ['<rootDir>/test/polyfills.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'],
  transform: {
    // SWC compila TypeScript/JSX sin depender de la API de «typescript» (más rápido y estable).
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } } },
    ],
  },
  moduleNameMapper: {
    '\\.(css|scss)$': 'identity-obj-proxy',
    // `import.meta.env` no existe en Jest: se sustituye el módulo de configuración por uno de prueba.
    '^(.*)/config/env$': '<rootDir>/test/envStub.ts',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.stories.tsx',
    '!src/**/*.test.{ts,tsx}',
    '!src/index.tsx',
    '!src/vite-env.d.ts',
  ],
}
