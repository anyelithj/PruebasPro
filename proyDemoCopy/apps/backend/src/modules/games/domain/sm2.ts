// [Función pura SM-2 · Sprint 8.5 · RF-99]: repetición espaciada (SuperMemo 2) — intervalo, facilidad y próxima fecha según la calidad del recuerdo (0 a 5) | [Patrón]: Domain Service sin estado | [Principio]: determinístico + SRP | [Paradigma]: Funcional (sin E/S, sin fecha implícita: `now` entra por parámetro)

export interface Sm2State {
  repetitions: number; // Repasos seguidos con éxito
  intervalDays: number;
  ease: number; // Factor de facilidad (mín. 1.3)
}

export const SM2_START: Sm2State = {
  repetitions: 0,
  intervalDays: 0,
  ease: 2.5,
};
const DAY_MS = 86_400_000;

export function sm2(
  state: Sm2State,
  quality: number,
  now: Date,
): Sm2State & { dueAt: Date } {
  const q = Math.max(0, Math.min(5, Math.round(quality))); // `Math.round` + límites: calidad entera 0..5
  // [Facilidad]: fórmula original de SM-2; nunca baja de 1.3
  const ease = Math.max(
    1.3,
    state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );
  // [Fallo]: calidad < 3 → vuelve a empezar y se repasa mañana
  const repetitions = q < 3 ? 0 : state.repetitions + 1;
  const intervalDays =
    q < 3
      ? 1
      : repetitions === 1
        ? 1
        : repetitions === 2
          ? 6
          : Math.round(state.intervalDays * ease);
  return {
    repetitions,
    intervalDays,
    ease: Number(ease.toFixed(2)),
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}
