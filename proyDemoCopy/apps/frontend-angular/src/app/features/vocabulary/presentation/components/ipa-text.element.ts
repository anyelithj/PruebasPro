import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { I18nService } from '@core/i18n/i18n.service';
import { IpaLabelComponent } from '@shared/ui/atoms/ipa-label/ipa-label.component';
import { AccentSwitchComponent } from '@shared/ui/molecules/accent-switch/accent-switch.component';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import { VocabularyFacade } from '../../application/vocabulary.facade';
import { ipaFor, LookupInputSchema, type Lookup } from '../../domain/models/vocabulary';
// [IpaTextElement · Angular Element <aula-ipa-text> · Sprint 8.3/8.4]: texto con su IPA (UK/US en inglés), traducción y sonido; Next.js lo monta en recursos y lecciones con <IpaTextHost> | [Patrón]: Adapter (componente → Custom Element) + Facade (repositorio) | [Principio]: DRY (misma consulta cacheada que el traductor) + bajo acoplamiento (Next solo pasa atributos)
// [Uso]: <aula-ipa-text text="umbrella" language="en" with-translation="true" with-switch="false"></aula-ipa-text> · los atributos (kebab-case) llegan como `input()` (camelCase)
// [Nombres]: `language` / `withTranslation` en vez de `lang` / `translate` → no pisan las propiedades nativas de HTMLElement
// [Resiliencia]: si la consulta falla, se queda el texto plano (nunca un hueco) · [A11y]: el IPA lleva `lang="xx-fonipa"`; la región es `aria-live` para anunciar el resultado

@Component({
  selector: 'aula-ipa-text-element',
  imports: [IpaLabelComponent, AccentSwitchComponent, PronunciationButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // [Fachada por instancia]: cada <aula-ipa-text> tiene su propio estado; el puerto → adaptador lo registra elements.ts (DIP)
  providers: [VocabularyFacade],
  template: `
    <span
      class="inline-flex flex-wrap items-center gap-x-2 gap-y-1 align-middle"
      aria-live="polite"
    >
      <!-- [ipa-only · 2026-10-23]: bajo un ejemplo que ya muestra su texto → solo IPA (y traducción si se pide), sin repetir la frase ni el botón -->
      @if (!onlyIpa()) {
        <span [attr.lang]="lang()" class="font-semibold">{{ text() }}</span>
      }
      @if (result(); as r) {
        <aula-ipa-label [ipa]="ipa(r)" [language]="lang()" />
        @if (showTranslation() && r.result.translation.translation) {
          <span class="text-sm text-muted-foreground" lang="es"
            >— {{ r.result.translation.translation }}</span
          >
        }
      } @else if (loading()) {
        <span class="text-xs text-muted-foreground">…</span>
      }
      @if (!onlyIpa()) {
        <aula-pronunciation-button
          [text]="text()"
          [language]="lang()"
          [label]="i18n.t().vocabulary.listen"
        />
      }
      @if (lang() === 'en' && accentSwitch()) {
        <aula-accent-switch [label]="i18n.t().vocabulary.accent" />
      }
    </span>
  `,
})
export class IpaTextElement {
  protected readonly i18n = inject(I18nService);
  private readonly speech = inject(SpeechSynthesisService);
  private readonly facade = inject(VocabularyFacade);
  readonly text = input(''); // Atributo `text`
  readonly language = input('en'); // Atributo `language` (ISO 639-1)
  readonly withTranslation = input<string | boolean>('true'); // Atributo `with-translation="false"` oculta la traducción
  readonly withSwitch = input<string | boolean>('false'); // Atributo `with-switch="true"` muestra el interruptor UK/US
  readonly ipaOnly = input<string | boolean>('false'); // Atributo `ipa-only="true"`: solo IPA (+ traducción) bajo un texto ya visible
  protected readonly lang = this.language; // Alias corto para la plantilla

  protected readonly result = this.facade.result.data; // Signal de la fachada (null mientras no hay resultado o si falló)
  protected readonly loading = this.facade.result.loading;
  // Atributos HTML llegan como texto → «"false"» debe apagar la opción
  protected readonly showTranslation = computed(() => `${this.withTranslation()}` !== 'false');
  protected readonly accentSwitch = computed(() => `${this.withSwitch()}` === 'true');
  protected readonly onlyIpa = computed(() => `${this.ipaOnly()}` === 'true');

  constructor() {
    // `effect`: cada cambio de texto o idioma relanza la consulta (NestJS responde de la caché si ya existe)
    effect(() => {
      const parsed = LookupInputSchema.safeParse({ text: this.text(), language: this.lang() });
      if (parsed.success) untracked(() => void this.facade.lookup(parsed.data)); // Si falla, queda el texto plano (respaldo)
    });
  }

  protected ipa(r: Lookup): string | null {
    return ipaFor(this.lang(), this.speech.accent(), r.result);
  }
}
