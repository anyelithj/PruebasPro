import { randomInt } from 'node:crypto';
// [Reglas de examen · 2026-11-06]: examen final de curso y examen de nivel — intentos, esperas, tiempo total y preguntas por intento | [Paradigma]: Funcional (funciones puras, testeables sin BD)
// practice = quiz de siempre (sin límites) · final = ligado a un curso, da el certificado del curso · level = idioma + nivel MCER sin curso, da el certificado de nivel

export const QUIZ_KINDS = ['practice', 'final', 'level'] as const;
export type QuizKind = (typeof QUIZ_KINDS)[number];
export const isExam = (kind: string | null | undefined): boolean =>
  kind === 'final' || kind === 'level';

export const PASS_SCORE = 70; // % mínimo para aprobar
export const ATTEMPTS_PER_ROUND = 3; // Intentos seguidos antes de la espera larga
export const WAIT_BETWEEN_MS = 10 * 60_000; // [2026-11-11]: 10 min entre intentos (antes 24 h: demasiada espera) → repasar y volver
export const WAIT_AFTER_ROUND_MS = 24 * 3600_000; // [2026-11-11]: tras 3 suspensos → 3 más pasadas 24 h (antes una semana)
export const QUESTIONS_PER_ATTEMPT = 15; // Cada intento saca 15 al azar del banco (≈ 25) → repetir no es memorizar
export const BANK_SIZE = 25;
export const GRACE_MS = 60_000; // Margen de red al enviar justo al acabar el tiempo

// [examMinutes]: tiempo TOTAL del examen por nivel MCER (no por pregunta) · sin nivel → 45 min
export function examMinutes(level: string | null | undefined): number {
  if (level === 'B1' || level === 'B2') return 75;
  if (level === 'C1' || level === 'C2') return 90;
  return 45;
}

export interface Attempt {
  startedAt: Date;
  passed: boolean | null;
}

export type Gate =
  | { ok: true; used: number; left: number }
  | { ok: false; reason: 'passed' | 'wait'; used: number; left: number; retryAt?: Date };

// [attemptGate]: ¿puede empezar otro intento? `attempts` = intentos TERMINADOS (cualquier orden)
// aprobado → no hace falta otro · cada 3 suspensos → espera de 24 h y se abren 3 más · entre intentos → 10 min
export function attemptGate(attempts: readonly Attempt[], now: Date): Gate {
  const used = attempts.length;
  const inRound = used % ATTEMPTS_PER_ROUND;
  const left = ATTEMPTS_PER_ROUND - inRound;
  if (attempts.some((a) => a.passed)) return { ok: false, reason: 'passed', used, left: 0 };
  if (!used) return { ok: true, used, left };
  const last = Math.max(...attempts.map((a) => a.startedAt.getTime()));
  const wait = inRound === 0 ? WAIT_AFTER_ROUND_MS : WAIT_BETWEEN_MS;
  const retryAt = new Date(last + wait);
  return retryAt.getTime() > now.getTime()
    ? { ok: false, reason: 'wait', used, left: inRound === 0 ? 0 : left, retryAt }
    : { ok: true, used, left };
}

// [pickQuestions]: n ids al azar sin repetir (Fisher–Yates parcial con `randomInt` de crypto)
export function pickQuestions(ids: readonly string[], n: number): string[] {
  const a = [...ids];
  const k = Math.min(n, a.length);
  for (let i = 0; i < k; i++) {
    const j = i + randomInt(a.length - i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, k);
}

// [percentOf]: aciertos sobre las preguntas DEL INTENTO (las no contestadas cuentan como fallo)
export const percentOf = (correct: number, total: number): number =>
  total ? Math.round((correct / total) * 100) : 0;

// [expired]: intento con tiempo total agotado (+ margen de red)
export const expired = (startedAt: Date, minutes: number, now: Date): boolean =>
  minutes > 0 && now.getTime() > startedAt.getTime() + minutes * 60_000 + GRACE_MS;
