// ab-test.model.ts (TypeScript puro) => RF-21.4 pruebas A/B de campañas de correo, sin base de datos (testeable):
//  - splitAudience: muestra aleatoria (Fisher-Yates) dividida en dos mitades iguales A y B
//  - chooseWinner: variante con mejor tasa (aperturas o clics sobre enviados); empate => A (la original)
// Paradigma: funcional. Patrón Strategy (la métrica decide el criterio).

export interface VariantResult {
  sent: number;
  opened: number;
  clicked: number;
}

// splitAudience => baraja una COPIA (no muta la entrada) y toma testPercent % repartido en dos grupos iguales
export function splitAudience<T>(audience: T[], testPercent: number, random: () => number = Math.random): { groupA: T[]; groupB: T[] } {
  const shuffled = [...audience];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]; // Intercambio por desestructuración
  }
  const half = Math.max(1, Math.floor((audience.length * testPercent) / 100 / 2));
  return { groupA: shuffled.slice(0, half), groupB: shuffled.slice(half, half * 2) };
}

// chooseWinner => tasa = métrica / enviados (0 si no hubo envíos)
export function chooseWinner(results: Record<"A" | "B", VariantResult>, metric: "OPEN" | "CLICK"): "A" | "B" {
  const rate = (r: VariantResult) => (r.sent ? (metric === "OPEN" ? r.opened : r.clicked) / r.sent : 0);
  return rate(results.B) > rate(results.A) ? "B" : "A";
}
