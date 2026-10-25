// [Jest setup]: registra matchers globales tras cargar el framework | [Principio]: DRY + SSOT

// [jest-dom]: matchers DOM (toBeInTheDocument, toHaveAttribute, ...) | [Buena práctica]: RTL
import "@testing-library/jest-dom";

// [jest-axe]: matcher toHaveNoViolations para tests de accesibilidad | [Buena práctica]: WCAG
import { toHaveNoViolations } from "jest-axe";
expect.extend(toHaveNoViolations);

// [matchMedia]: jsdom no lo implementa; algunos componentes/hooks lo consultan | [Patrón]: Polyfill de test
// `typeof window` (JS): las pruebas de servidor (`@jest-environment node`, p. ej. Route Handlers del BFF) no tienen window
if (typeof window !== "undefined") Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

// [ResizeObserver]: requerido por algunos primitives Radix bajo jsdom | [Patrón]: Polyfill de test
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;
