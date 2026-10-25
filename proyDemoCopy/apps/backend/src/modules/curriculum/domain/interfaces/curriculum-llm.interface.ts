// [Puerto LLM del contexto Curriculum]: "dame JSON para este prompt" + métricas reales de la inferencia | [Patrón]: Port (Hexagonal) + Dependency Inversion | [Principio]: DIP + ISP | [Paradigma]: POO (contrato)
// [Por qué un puerto propio]: el dominio no depende de Ollama/HTTP; cambiar de proveedor = otro Adapter, sin tocar los casos de uso (OCP)

// `export interface` (TS): métricas que el proveedor PUEDE informar | `null` = no disponible (nunca se estima ni se inventa)
export interface LlmMetrics {
  model: string;
  modelDigest: string | null;
  quantization: string | null;
  parameterSize: string | null;
  promptTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  loadMs: number | null;
  ramBytes: number | null;
  vramBytes: number | null;
}

// `export interface` (TS): resultado de una inferencia
export interface LlmResult {
  data: unknown; // JSON producido por el modelo (aún sin validar → el llamador DEBE validarlo)
  metrics: LlmMetrics;
}

export interface CurriculumLlm {
  generateJson(prompt: string, maxTokens: number, temperature?: number): Promise<LlmResult>; // [2026-10-20]: `temperature` opcional → los reintentos piden más variedad
}

// `Symbol` (ES2015): token único de inyección (evita colisiones de nombres en el contenedor DI de NestJS)
export const CURRICULUM_LLM = Symbol('CURRICULUM_LLM');
