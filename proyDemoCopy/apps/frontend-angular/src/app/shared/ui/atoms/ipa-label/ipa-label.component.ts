import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { splitArticleIpa } from '@aula/shared-schemas';
// [IpaLabelComponent · Átomo · Sprint 8.3]: transcripción IPA entre barras con `lang="xx-fonipa"` | [Patrón]: Atomic Design (átomo) | [Principio]: SRP + DRY (traductor, banco, juegos y <aula-ipa-text> pintan el IPA igual)
// [A11y]: `lang` con la subetiqueta BCP 47 «fonipa» → los lectores de pantalla no intentan leer los símbolos como palabras del idioma de la página
// [Tipografía]: Inter (fuente del sistema de diseño) cubre los símbolos IPA (ˈ ʌ ə ɹ …); `tracking-wide` separa los diacríticos

@Component({
  selector: 'aula-ipa-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline' },
  template: `
    @if (split(); as p) {
      <!-- [2026-11-09]: artículo y sustantivo en barras separadas; el artículo en otro color (der Hund → /deːɐ̯/ /ˈhʊnt/) -->
      <span [attr.lang]="tag()" class="tracking-wide" [title]="title()"
        ><span class="font-semibold text-[#f72585]" title="Artículo">/{{ p[0] }}/</span>
        <span class="text-muted-foreground">/{{ p[1] }}/</span></span
      >
    } @else if (ipa()) {
      <span [attr.lang]="tag()" class="tracking-wide text-muted-foreground" [title]="title()"
        >/{{ ipa() }}/</span
      >
    } @else {
      <span class="text-muted-foreground" aria-hidden="true">—</span>
    }
  `,
})
export class IpaLabelComponent {
  readonly ipa = input<string | null | undefined>(null); // Transcripción sin barras
  readonly language = input('en'); // Idioma ISO 639-1 de la palabra
  readonly title = input(''); // Tooltip opcional («IPA británico»)
  readonly text = input<string | null | undefined>(null); // Texto escrito (opcional) → detecta el artículo inicial
  protected readonly tag = computed(() => `${this.language()}-fonipa`); // `computed`: se recalcula solo si cambia el idioma
  // [split · 2026-11-09]: [IPA del artículo, IPA del resto] si el texto empieza con artículo; si no, null
  protected readonly split = computed(() => splitArticle(this.ipa(), this.text(), this.language()));
}

// [splitArticle]: vive en @aula/shared-schemas (Next.js lo usa igual)
export const splitArticle = splitArticleIpa;
