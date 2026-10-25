// [Jest config]: solo tests unit/integration (jsdom) — excluye Playwright (functional/performance/usability) | [Patrón]: Config Module | [Principio]: SoC
// [.mjs]: evita dependencia de ts-node; next/jest se importa como ESM | [Principio]: KISS
import nextJest from "next/jest.js";

// [next/jest]: carga next.config + .env y resuelve SWC/TS automáticamente | [Principio]: DRY
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  // [jsdom]: entorno DOM para React Testing Library
  testEnvironment: "jest-environment-jsdom",
  // [setup]: matchers jest-dom + jest-axe se registran tras el framework
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // [testMatch]: SOLO unit + integration; los .spec.ts de Playwright quedan fuera | [Principio]: SoC
  testMatch: [
    "<rootDir>/__tests__/unit/**/*.test.{ts,tsx}",
    "<rootDir>/__tests__/integration/**/*.test.{ts,tsx}",
  ],
  // [ignore]: Playwright vive en functional/performance/usability (E2E/Lighthouse) — nunca con Jest
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/__tests__/functional/",
    "<rootDir>/__tests__/performance/",
    "<rootDir>/__tests__/usability/",
  ],
  // [alias @/*]: replica el paths de tsconfig | [Principio]: SSOT
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@aula/(.*)$": "<rootDir>/../../packages/$1", // [Sprint 7.1]: paquetes compartidos del monorepo
  },
  // [coverage]: se mide SOLO sobre las unidades cubiertas por esta suite unit | [Meta]: ≥85%
  // NOTA: el resto del código (api-client, auth.ts, useQuiz, páginas, primitives sin test, y los
  // archivos src de 0 bytes aún sin implementar) queda fuera del scope de cobertura de esta tanda.
  collectCoverageFrom: [
    "src/lib/utils.ts",
    "src/lib/validations.ts",
    "src/store/slices/authSlice.ts",
    "src/store/slices/quizSlice.ts",
    "src/hooks/useTimer.ts",
    "src/hooks/useAuth.ts",
    "src/components/ui/button.tsx",
    "src/components/ui/input.tsx",
    "src/components/ui/label.tsx",
    "src/components/quiz/AnswerOption.tsx",
    "src/components/quiz/QuestionCard.tsx",
    "src/components/quiz/ScoreDisplay.tsx",
    "src/components/quiz/TimerBar.tsx",
    "src/components/quiz/DifficultyBadge.tsx",
    "src/components/quiz/QuizProgress.tsx",
    "src/components/auth/LoginForm.tsx",
    "src/components/auth/RegisterForm.tsx",
    "src/components/auth/OAuthButtons.tsx",
    "src/components/ui/password-input.tsx",
    "!src/**/*.d.ts",
  ],
};

// [export]: createJestConfig es async para inyectar la config Next | [Patrón]: Factory async
export default createJestConfig(config);
