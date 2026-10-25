import { SpeakButton } from "@/components/curriculum/SpeakButton"; // [Reutilización]: audio natural del sistema → espeak-ng del servidor → voz del navegador | [Principio]: DRY
import { IPA_CHART_EN } from "@/config/ipa-chart"; // [SSOT]: datos del alfabeto fonético
// [IpaChart · 2026-10-23]: «Alfabeto fonético (IPA)» en Recursos › Pronunciación — temas en píldoras (anclas) + por fonema: símbolo, ejemplo con audio UK/US, grafías y regla de cuándo se aplica
// [Patrón]: Presentational (RSC; solo los botones de audio se hidratan) | [Principio]: SRP | [SEO + a11y]: <section> por tema con <h2>/<h3>, tabla semántica con <caption> y <th scope>, IPA con lang="en-fonipa"

export function IpaChart() {
  return (
    <section aria-labelledby="ipa-chart-title" className="surface space-y-4 p-4 sm:p-5">
      <header className="space-y-1">
        <h2 id="ipa-chart-title" className="text-lg font-extrabold">Alfabeto fonético del inglés (IPA)</h2>
        <p className="text-sm text-muted-foreground">Los 44 sonidos del inglés agrupados por temas. Pulsa el altavoz para oír la palabra en acento británico (UK) o estadounidense (US) y lee cuándo se usa cada sonido.</p>
      </header>

      {/* [Temas en píldoras]: anclas a cada sección → navegación rápida con teclado y lector de pantalla */}
      <nav aria-label="Temas del alfabeto fonético" className="flex flex-wrap gap-1.5">
        {IPA_CHART_EN.map((t) => (
          <a key={t.id} href={`#${t.id}`} className="chip">
            {t.title} <span className="text-muted-foreground">({t.phonemes.length})</span>
          </a>
        ))}
      </nav>

      {IPA_CHART_EN.map((t) => (
        <section key={t.id} id={t.id} aria-labelledby={`${t.id}-h`} className="scroll-mt-20 space-y-2">
          <h3 id={`${t.id}-h`} className="text-base font-bold">{t.title}</h3>
          <p className="text-xs text-muted-foreground">{t.intro}</p>
          {/* [Responsive]: la tabla se desplaza en horizontal dentro de su caja en móvil (la página no) */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">{t.title}: símbolo, ejemplo, grafías y regla</caption>
              <thead className="bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2">Sonido</th>
                  <th scope="col" className="px-3 py-2">Ejemplo</th>
                  <th scope="col" className="px-3 py-2">Se escribe</th>
                  <th scope="col" className="px-3 py-2">Cuándo se aplica</th>
                </tr>
              </thead>
              <tbody>
                {t.phonemes.map((p) => (
                  <tr key={p.symbol} className="border-t border-border align-top">
                    <th scope="row" className="px-3 py-2">
                      <span lang="en-fonipa" className="rounded-md bg-tone-brand-soft px-2 py-0.5 font-mono text-base font-bold text-tone-brand">/{p.symbol}/</span>
                    </th>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span lang="en" className="font-semibold">{p.example}</span>
                        <span lang="en-fonipa" className="font-mono text-xs text-muted-foreground">/{p.exampleIpa}/</span>
                        <SpeakButton text={p.example} lang="en" variant="en-GB" label={`Escuchar «${p.example}» en acento británico`} />
                        <span aria-hidden className="text-[10px] font-semibold text-muted-foreground">UK</span>
                        <SpeakButton text={p.example} lang="en" variant="en-US" label={`Escuchar «${p.example}» en acento estadounidense`} />
                        <span aria-hidden className="text-[10px] font-semibold text-muted-foreground">US</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.spellings}</td>
                    <td className="px-3 py-2 text-xs leading-relaxed">{p.ruleEs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </section>
  );
}
