// [Value Object AIProvider]: catálogo cerrado de motores LLM locales servidos por Ollama | [Patrón]: Value Object | [Principio]: SRP + OCP | [Paradigma]: Declarativo

// `export enum` (TS): identificadores estables para seleccionar motor desde DTO/UI
export enum AIProvider {
  AYA = 'aya', // Aya Expanse 8B (Cohere For AI) — multilingüe; licencia CC-BY-NC 4.0 (uso no comercial)
  QWEN = 'qwen', // Qwen3 8B — comparación
  MISTRAL = 'mistral', // Mistral Nemo — comparación (solo si está instalado localmente)
}

// [Provider por defecto]: Aya prioriza calidad multilingüe (decisión del autor, ver ADR 0006) | [Patrón]: Default Policy
export const DEFAULT_AI_PROVIDER: AIProvider = AIProvider.AYA;

// [Fallback]: SOLO se usa si AI_FALLBACK_ENABLED=true; cargar un segundo modelo duplica RAM en equipos de 8 GB | [Patrón]: Fallback Chain opcional
export const FALLBACK_AI_PROVIDER: AIProvider = AIProvider.QWEN;

// [Etiquetas legibles]: Swagger / UI / logs | [Patrón]: Lookup Table
export const AI_PROVIDER_LABEL: Readonly<Record<AIProvider, string>> =
  Object.freeze({
    [AIProvider.AYA]: 'Aya Expanse 8B',
    [AIProvider.QWEN]: 'Qwen3 8B',
    [AIProvider.MISTRAL]: 'Mistral Nemo',
  });

// [Tags de Ollama por defecto]: sobrescribibles por env (OLLAMA_AYA_MODEL, OLLAMA_QWEN_MODEL, OLLAMA_MISTRAL_MODEL) | [Principio]: SSOT + OCP
export const AI_PROVIDER_MODEL: Readonly<Record<AIProvider, string>> =
  Object.freeze({
    [AIProvider.AYA]: 'aya-expanse:8b', // Q4_K_M (verificado con `ollama show`)
    [AIProvider.QWEN]: 'qwen3:8b',
    [AIProvider.MISTRAL]: 'mistral-nemo',
  });

// [Type guard]: normaliza querystring/body crudo | `value is AIProvider` (TS) estrecha el tipo
export function isAIProvider(value: string): value is AIProvider {
  return Object.values(AIProvider).includes(value as AIProvider);
}
