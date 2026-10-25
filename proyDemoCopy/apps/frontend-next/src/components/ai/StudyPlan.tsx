import type { StudyPlanStep } from "@/lib/ai-api";
// [StudyPlan · Sprint 5.2]: plan de estudio ordenado, agrupado por tema, con el tiempo estimado | [Patrón]: Presentational | [Principio]: SRP | [Tecnología]: React Server Component + Tailwind CSS
// [Accesibilidad]: <ol> (el orden importa) con encabezado por tema; minutos en texto

export function StudyPlan({ steps, totalMinutes }: { steps: StudyPlanStep[]; totalMinutes: number }) {
  // [Agrupar por tema]: `Map` (ES2015) conserva el orden de aparición (el del plan)
  const byTopic = new Map<string, StudyPlanStep[]>();
  for (const s of steps) byTopic.set(s.topic, [...(byTopic.get(s.topic) ?? []), s]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {steps.length} actividades · unos <b className="text-foreground">{totalMinutes} minutos</b> en total
      </p>
      <ol className="grid gap-3 md:grid-cols-2">
        {[...byTopic.entries()].map(([topic, items]) => (
          <li key={topic} className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-bold">{topic}</h3>
            <ol className="space-y-1.5">
              {items.map((s) => (
                <li key={s.order} className="flex items-start gap-2 text-sm">
                  <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-tone-brand-soft text-[10px] font-bold text-tone-brand">
                    {s.order}
                  </span>
                  <span className="flex-1">{s.activity}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{s.estimated_minutes} min</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
