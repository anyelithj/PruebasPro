import type {
  CorrectorInput,
  CorrectorResult,
} from '../../../ai/own-llm-client.service'; // `import type` (TS): solo el contrato, se borra al compilar
// [Port SentenceCorrectorPort · 2026-11-13 · Anexo A]: el turno del usuario se corrige UNA vez con el corrector pedagógico único
// → el mismo JSON alimenta el feedback, la puntuación y la frase sobre la que responde el avatar | [Patrón]: Port (Hexagonal) | [Principio]: DIP + ISP

export const SENTENCE_CORRECTOR = Symbol('SENTENCE_CORRECTOR'); // `Symbol` (ES2015): token de inyección

export type TurnFeedback = CorrectorResult; // Lo que se guarda en dialogue_turns.feedback (jsonb) y ve la UI

export interface SentenceCorrectorPort {
  // null = corrector no disponible → el turno sigue (el avatar responde a lo dicho) y la UI no inventa un veredicto
  correct(input: CorrectorInput, token: string): Promise<TurnFeedback | null>;
}
