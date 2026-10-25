import type { Dictionary } from "@aula/shared-i18n";
// [HowItWorks · Sprint 7.13]: cómo funciona en tres pasos | [Patrón]: Presentational Component + Data-driven rendering | [Principio]: SRP (antes inline en app/page.tsx) | [Paradigma]: Declarativo
// [A11y]: <ol> numerada (el número visible es decorativo; el lector anuncia el orden de la lista)

export function HowItWorks({ l }: { l: Dictionary["landing"] }) {
  return (
    <section className="section" id="como-funciona" aria-labelledby="como-title">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">{l.howEyebrow}</span>
          <h2 id="como-title">{l.howTitle}</h2>
        </div>
        <ol className="feature-grid list-none p-0">
          {l.steps.map((s, i) => (
            <li key={s.title} className="feature-card">
              <div className="icon" aria-hidden>
                <b className="text-[22px]">{i + 1}</b>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
