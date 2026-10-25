// [Value Object Difficulty]: enum cerrado + helpers de scoring | [Patrón]: Value Object | [Principio]: SRP + LSP | [Paradigma]: POO

// [Enum]: niveles soportados ("easy"|"medium"|"hard") — mapeados a bandas MCER/CEFR
export enum Difficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

// [Multiplicador de score]: usado por CalculateScoreUseCase | [Patrón]: Policy
export const DIFFICULTY_MULTIPLIER: Readonly<Record<Difficulty, number>> =
  Object.freeze({
    [Difficulty.EASY]: 1.0,
    [Difficulty.MEDIUM]: 1.5,
    [Difficulty.HARD]: 2.0,
  });

// [Banda MCER/CEFR]: A = usuario básico, B = independiente, C = competente (Consejo de Europa).
// Mapeo provisional de 3 dificultades → 3 bandas hasta modelar los 6 niveles | [Patrón]: Lookup Table
export const DIFFICULTY_CEFR_BAND: Readonly<Record<Difficulty, string>> =
  Object.freeze({
    [Difficulty.EASY]: 'A1–A2',
    [Difficulty.MEDIUM]: 'B1–B2',
    [Difficulty.HARD]: 'C1–C2',
  });

// [Guard de validez]: usado al normalizar respuestas de la IA | [Principio]: DRY
export function isDifficulty(value: string): value is Difficulty {
  return Object.values(Difficulty).includes(value as Difficulty);
}
