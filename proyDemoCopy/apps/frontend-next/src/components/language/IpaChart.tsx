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
          {/* [Tarjetas · 2026-10-25]: una tarjeta por fonema (/ɒ/ grande) con su tabla dentro: ejemplo con audio UK/US, grafías y regla de uso | [Responsive]: 1 → 2 → 3 columnas */}
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {t.phonemes.map((p) => (
              <li key={p.symbol} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between gap-2 bg-tone-brand-soft px-4 py-3">
                  <span lang="en-fonipa" className="font-mono text-3xl font-extrabold text-tone-brand">/{p.symbol}/</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.title}</span>
                </div>
                <table className="w-full text-sm">
                  <caption className="sr-only">Fonema /{p.symbol}/: ejemplo, grafías y regla</caption>
                  <tbody>
                    <tr className="border-t border-border align-top">
                      <th scope="row" className="w-28 px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Ejemplo</th>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span lang="en" className="font-semibold">{p.example}</span>
                          <span lang="en-fonipa" className="font-mono text-xs text-muted-foreground">/{p.exampleIpa}/</span>
                        </span>
                      </td>
                    </tr>
                    <tr className="border-t border-border align-top">
                      <th scope="row" className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Sonido</th>
                      <td className="px-3 py-2">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <SpeakButton text={p.example} lang="en" variant="en-GB" label={`Escuchar «${p.example}» en acento británico`} />
                          <span aria-hidden className="text-[10px] font-semibold text-muted-foreground">UK</span>
                          <SpeakButton text={p.example} lang="en" variant="en-US" label={`Escuchar «${p.example}» en acento estadounidense`} />
                          <span aria-hidden className="text-[10px] font-semibold text-muted-foreground">US</span>
                        </span>
                      </td>
                    </tr>
                    <tr className="border-t border-border align-top">
                      <th scope="row" className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Se escribe</th>
                      <td className="px-3 py-2 font-mono text-xs">{p.spellings}</td>
                    </tr>
                    <tr className="border-t border-border align-top">
                      <th scope="row" className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-muted-foreground">Regla y uso</th>
                      <td className="px-3 py-2 text-xs leading-relaxed">{p.ruleEs}</td>
                    </tr>
                  </tbody>
                </table>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
