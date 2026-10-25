import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { I18nService, type Dict } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { IpaLabelComponent } from '@shared/ui/atoms/ipa-label/ipa-label.component';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import { ipaFor, type VocabularyEntry } from '../../domain/models/vocabulary';
// [VocabularyEntryTableComponent · Presentacional · Sprint 8.3]: tabla del banco con IPA (según el acento activo), sonido y estado «automático» / «revisado» | [Patrón]: Presentational Component | [Principio]: SRP | [Paradigma]: Declarativo
// [A11y]: <table> con <caption> y <th scope> · estado con texto + icono (no solo color) · acciones con el término en el nombre accesible
// [Responsive]: en móvil la tabla se desplaza dentro de su caja (`overflow-x-auto`) en vez de romper la página

@Component({
  selector: 'aula-vocabulary-entry-table',
  imports: [BadgeComponent, ButtonComponent, IpaLabelComponent, PronunciationButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = t();
    <div class="overflow-x-auto rounded-xl border border-border">
      <table class="w-full min-w-[40rem] text-left text-sm">
        <caption class="sr-only">
          {{
            tx.bankTitle
          }}
        </caption>
        <thead class="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" class="px-3 py-2">{{ tx.colTerm }}</th>
            <th scope="col" class="px-3 py-2">{{ tx.colTranslation }}</th>
            <th scope="col" class="px-3 py-2">{{ tx.colIpa }}</th>
            <th scope="col" class="px-3 py-2">{{ tx.colStatus }}</th>
            <th scope="col" class="px-3 py-2 text-right">{{ tx.colActions }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          @for (e of items(); track e.id) {
            <tr [class.bg-tone-brand-soft]="e.id === selectedId()">
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <aula-pronunciation-button
                    [text]="e.term"
                    [language]="e.language"
                    [label]="tx.listen"
                  />
                  <div class="min-w-0">
                    <p class="font-semibold" [attr.lang]="e.language">{{ e.term }}</p>
                    <p class="text-xs text-muted-foreground">{{ i18n.languageName(e.language) }}</p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-2" lang="es">{{ e.translation || '—' }}</td>
              <td class="px-3 py-2"><aula-ipa-label [ipa]="ipa(e)" [language]="e.language" /></td>
              <td class="px-3 py-2">
                @if (e.reviewed) {
                  <aula-badge tone="brand">{{ tx.reviewed }}</aula-badge>
                } @else {
                  <aula-badge tone="warning">{{ tx.auto }}</aula-badge>
                }
              </td>
              <td class="px-3 py-2">
                <div class="flex justify-end gap-1">
                  <button
                    aulaButton
                    variant="outline"
                    size="sm"
                    type="button"
                    [attr.aria-label]="tx.edit + ': ' + e.term"
                    (click)="edit.emit(e)"
                  >
                    {{ tx.edit }}
                  </button>
                  <button
                    aulaButton
                    variant="ghost"
                    size="sm"
                    type="button"
                    class="text-tone-danger"
                    [attr.aria-label]="tx.remove + ': ' + e.term"
                    [disabled]="busy()"
                    (click)="remove.emit(e)"
                  >
                    {{ tx.remove }}
                  </button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class VocabularyEntryTableComponent {
  protected readonly i18n = inject(I18nService);
  private readonly speech = inject(SpeechSynthesisService);
  readonly t = input.required<Dict['vocabulary']>();
  readonly items = input.required<VocabularyEntry[]>();
  readonly selectedId = input<string | null>(null);
  readonly busy = input(false);
  readonly edit = output<VocabularyEntry>();
  readonly remove = output<VocabularyEntry>();

  // [ipa]: variante del acento activo (signal del servicio → la tabla cambia al pulsar UK/US)
  protected ipa(e: VocabularyEntry): string | null {
    return ipaFor(e.language, this.speech.accent(), e);
  }
}
