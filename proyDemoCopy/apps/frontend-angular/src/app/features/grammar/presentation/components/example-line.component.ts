import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { ipaForAccent } from '@core/dictionary/dictionary.model';
import { IpaLabelComponent } from '@shared/ui/atoms/ipa-label/ipa-label.component';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import { WordLookupComponent } from '@shared/ui/organisms/word-lookup/word-lookup.component';
import type { Example } from '../../domain/models/grammar';
// [ExampleLineComponent · Presentacional · Sprint 10.11 · RF-134/RF-136]: un ejemplo — texto con diccionario (cada palabra se pulsa), IPA UK/US según el interruptor (evento aula:accent-changed), sonido y traducción al español visible por defecto | [Patrón]: Presentational Component + Composition (WordLookup de shared) | [Principio]: DRY (mismo diccionario que cualquier texto) + accesibilidad | [Paradigma]: Declarativo + Reactivo

@Component({
  selector: 'aula-example-line',
  imports: [WordLookupComponent, IpaLabelComponent, PronunciationButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <span class="flex items-start gap-2">
      <aula-pronunciation-button [text]="example().text" [language]="language()" [label]="listenLabel()" />
      <span class="min-w-0 flex-1">
        <span class="block text-base font-semibold leading-snug">
          <aula-word-lookup [text]="example().text" [language]="language()" />
        </span>
        <span class="block text-xs"><aula-ipa-label [ipa]="ipa()" [language]="language()" /></span>
        @if (showTranslation() && example().translation) {
          <span class="mt-0.5 block text-sm text-muted-foreground" lang="es">→ {{ example().translation }}</span>
        }
        @if (!example().reviewed && unreviewedLabel()) {
          <span class="mt-0.5 block text-[11px] text-muted-foreground">◌ {{ unreviewedLabel() }}</span>
        }
      </span>
    </span>
  `,
})
export class ExampleLineComponent {
  private readonly speech = inject(SpeechSynthesisService);
  readonly example = input.required<Example>();
  readonly language = input('en');
  readonly showTranslation = input(true);
  readonly listenLabel = input('Escuchar el ejemplo');
  readonly unreviewedLabel = input(''); // Vacío = no avisar (estudiantes); el editor lo muestra

  protected readonly ipa = computed(() => ipaForAccent(this.language(), this.speech.accent(), this.example()));
}
