import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { ipaForAccent } from '@core/dictionary/dictionary.model';
import { IpaLabelComponent } from '@shared/ui/atoms/ipa-label/ipa-label.component';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import type { Term } from '../../domain/models/polyglot';
// [PolyglotCellComponent · Presentacional · Sprint 10.7 · RF-130/RF-132]: un término con su IPA (UK o US según el interruptor en inglés), su botón de sonido y el aviso de revisión pendiente (chino mandarín y ruso: hablante nativo) | [Patrón]: Presentational Component | [Principio]: SRP + DRY (tabla y tarjetas pintan la misma celda) | [Paradigma]: Declarativo
// [A11y]: el término lleva `lang` (lectores de pantalla y voz correcta); el aviso es texto con icono, no solo color

@Component({
  selector: 'aula-polyglot-cell',
  imports: [IconComponent, IpaLabelComponent, PronunciationButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (term(); as t) {
      <span class="flex items-start gap-2">
        <span class="min-w-0 flex-1">
          <span class="block text-base font-bold leading-tight" [attr.lang]="language()">{{ t.text }}</span>
          <span class="block text-xs"><aula-ipa-label [ipa]="ipa()" [language]="language()" /></span>
          @if (t.needsNativeReview) {
            <span class="mt-1 inline-block text-[11px] text-tone-warning" [title]="nativeLabel()"><aula-icon name="triangle-alert" /> {{ nativeLabel() }}</span>
          } @else if (!t.reviewed && showReview()) {
            <span class="mt-1 inline-block text-[11px] text-muted-foreground">◌ {{ unreviewedLabel() }}</span>
          }
        </span>
        <aula-pronunciation-button
          [text]="t.text"
          [language]="language()"
          [label]="listenLabel().replace('{w}', t.text).replace('{l}', languageName())"
        />
      </span>
    } @else {
      <span class="text-xs italic text-muted-foreground">— {{ missingLabel() }}</span>
    }
  `,
})
export class PolyglotCellComponent {
  private readonly speech = inject(SpeechSynthesisService);
  readonly term = input<Term | null>(null);
  readonly language = input.required<string>();
  readonly languageName = input('');
  readonly showReview = input(false);
  readonly listenLabel = input('Escuchar «{w}» en {l}');
  readonly missingLabel = input('Sin término');
  readonly unreviewedLabel = input('IPA automático sin revisar');
  readonly nativeLabel = input('Pendiente de revisión nativa');

  protected readonly ipa = computed(() => {
    const t = this.term();
    return t ? ipaForAccent(this.language(), this.speech.accent(), t) : null;
  });
}
