import type { Dictionary } from "@aula/shared-i18n";
// [LocalAiPrivacy · Sprint 7.13]: IA local (Ollama), contenido revisado primero y certificados verificables | [Patrón]: Presentational Component | [Principio]: SRP + transparencia (la landing dice cómo se usa la IA) | [Paradigma]: Declarativo

export function LocalAiPrivacy({ l }: { l: Dictionary["landing"] }) {
  return (
    <section className="section" id="ia-local" aria-labelledby="ia-title">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">{l.aiEyebrow}</span>
          <h2 id="ia-title">{l.aiTitle}</h2>
          <p>{l.aiLead}</p>
        </div>
        <ul className="feature-grid list-none p-0">
          {l.aiPoints.map((p) => (
            <li key={p.title} className="feature-card">
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
