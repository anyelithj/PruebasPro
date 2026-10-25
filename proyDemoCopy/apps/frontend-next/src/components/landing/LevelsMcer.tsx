import { CEFR_LEVELS } from "@/lib/constants";
import type { Dictionary } from "@aula/shared-i18n";
// [LevelsMcer · Sprint 7.13]: los seis niveles del MCER (A1–C2) con lo que se logra en cada uno | [Patrón]: Presentational Component + Lookup Table (texto por nivel en el diccionario) | [Principio]: SSOT (niveles de lib/constants) + SRP | [Paradigma]: Declarativo
// [A11y]: <ol> → el orden de los niveles tiene significado · [Responsive]: rejilla de 1 → 2 → 3 columnas

export function LevelsMcer({ l }: { l: Dictionary["landing"] }) {
  return (
    <section className="section" id="niveles" aria-labelledby="niveles-title" style={{ background: "var(--bg-alt)" }}>
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">{l.levelsEyebrow}</span>
          <h2 id="niveles-title">{l.levelsTitle}</h2>
          <p>{l.levelsLead}</p>
        </div>
        <ol className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {CEFR_LEVELS.map((lvl) => (
            <li key={lvl} className="feature-card">
              <div className="icon" aria-hidden>
                <b>{lvl}</b>
              </div>
              <h3 className="sr-only">{lvl}</h3>
              <p>{l.levels[lvl]}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
