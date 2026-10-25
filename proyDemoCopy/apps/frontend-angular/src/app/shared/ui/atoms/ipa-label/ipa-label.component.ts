import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
// [IpaLabelComponent · Átomo · Sprint 8.3]: transcripción IPA entre barras con `lang="xx-fonipa"` | [Patrón]: Atomic Design (átomo) | [Principio]: SRP + DRY (traductor, banco, juegos y <aula-ipa-text> pintan el IPA igual)
// [A11y]: `lang` con la subetiqueta BCP 47 «fonipa» → los lectores de pantalla no intentan leer los símbolos como palabras del idioma de la página
// [Tipografía]: Inter (fuente del sistema de diseño) cubre los símbolos IPA (ˈ ʌ ə ɹ …); `tracking-wide` separa los diacríticos

@Component({
  selector: 'aula-ipa-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline' },
  template: `
    @if (ipa()) {
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
  protected readonly tag = computed(() => `${this.language()}-fonipa`); // `computed`: se recalcula solo si cambia el idioma
}
