import { GAME_META, type GameType } from '../../domain/game-type';
import type { GameSessionContent } from '../../domain/entities/game-session.entity';
// [Strategy GameEvaluator · Sprint 8.5 · RF-98/RF-103/RF-104]: evalúa una ronda según la familia del juego — cerrados (vocabulario) y de comprensión en NestJS; los orales con agente los decide el motor de FastAPI | [Patrón]: Strategy (mapa familia → función) | [Principio]: OCP + determinístico (sin IA) | [Paradigma]: Funcional (funciones puras)

export interface RoundInput {
  answer: string;
  entryIndex?: number; // Palabra de la partida (vocabulario)
  lineIndex?: number; // Frase de la partida (comprensión)
  expected?: 'term' | 'translation' | 'category'; // Qué debía escribir: la palabra, su traducción o su categoría (quick_sort)
}

export interface RoundVerdict {
  correct: boolean | null; // null = juego abierto (se mide fluidez, no hay una sola respuesta)
  expected?: string;
  overlap?: number; // Comprensión: proporción de palabras de la frase que dijo
}

// [norm/words]: minúsculas, sin tildes ni signos → «Café!» == «cafe» | `normalize('NFD')` separa la tilde
export const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
export const words = (s: string): string[] =>
  norm(s).split(' ').filter(Boolean);

const overlapOf = (said: string, line: string): number => {
  const target = words(line);
  const got = new Set(words(said));
  return target.length
    ? target.filter((w) => got.has(w)).length / target.length
    : 0;
};

type Evaluator = (
  input: RoundInput,
  content: GameSessionContent,
  game: GameType,
) => RoundVerdict;

const vocab: Evaluator = (input, content) => {
  const card = content.vocabulary[input.entryIndex ?? -1];
  if (!card) return { correct: null };
  const expected =
    input.expected === 'translation'
      ? (card.translation ?? card.term)
      : input.expected === 'category'
        ? (card.category ?? '') // [Sprint 8.8]: clasificación rápida → la respuesta es el grupo elegido
        : card.term;
  return { correct: norm(input.answer) === norm(expected), expected };
};

// [numberWords · 2026-10-19]: cifra → palabra en en/es/fr («8» → «eight», «ocho», «huit» se comparan como la misma) | [Patrón]: Lookup Table | Función pura
// ponytail: solo 0–12 (lo que usan las frases); un conversor completo si el banco usa cifras mayores
const DIGIT_WORDS: Readonly<Record<string, string>> = Object.fromEntries(
  [
    ['zero', 'cero', 'zéro'], ['one', 'uno', 'un'], ['two', 'dos', 'deux'], ['three', 'tres', 'trois'], ['four', 'cuatro', 'quatre'],
    ['five', 'cinco', 'cinq'], ['six', 'seis', 'six'], ['seven', 'siete', 'sept'], ['eight', 'ocho', 'huit'], ['nine', 'nueve', 'neuf'],
    ['ten', 'diez', 'dix'], ['eleven', 'once', 'onze'], ['twelve', 'doce', 'douze'],
  ].flatMap((names, n) => names.map((w) => [w, String(n)])),
);
const numberWords = (ws: string[]): string[] => ws.map((w) => DIGIT_WORDS[w] ?? w);

const listening: Evaluator = (input, content, game) => {
  const line = content.lines?.[input.lineIndex ?? -1];
  if (!line) return { correct: null };
  const overlap = Number(overlapOf(input.answer, line.text).toFixed(2));
  switch (game) {
    case 'partial_dictation': // Escribir la palabra oculta
      return {
        correct: norm(input.answer) === norm(line.gap ?? ''),
        expected: line.gap,
        overlap,
      };
    case 'quick_qa': // La respuesta contiene la palabra clave (cifras y palabras valen igual: «8» = «eight», «2 years» = «two years»)
      return {
        correct: ` ${numberWords(words(input.answer)).join(' ')} `.includes(
          ` ${numberWords(words(line.answer ?? '')).join(' ')} `,
        ),
        expected: line.answer,
        overlap,
      };
    case 'listen_reformulate': // Mismo sentido con otras palabras: parecido pero no idéntico
      return {
        correct: overlap >= 0.3 && norm(input.answer) !== norm(line.text),
        expected: line.text,
        overlap,
      };
    default: // shadowing: repetir la frase (≥ 70 % de las palabras)
      return { correct: overlap >= 0.7, expected: line.text, overlap };
  }
};

const open: Evaluator = () => ({ correct: null });

const BY_FAMILY: Record<string, Evaluator> = {
  vocab,
  listening,
  oral: open,
  agent: open,
};

export function evaluateRound(
  game: GameType,
  input: RoundInput,
  content: GameSessionContent,
): RoundVerdict {
  return BY_FAMILY[GAME_META[game].family](input, content, game);
}
