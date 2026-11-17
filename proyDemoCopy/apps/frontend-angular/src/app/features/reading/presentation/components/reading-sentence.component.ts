import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { termKey, type MarkedWord } from '@core/dictionary/dictionary.model';
import { wordIpa, type ReadingSentence, type Token } from '../../domain/models/reading';
// [2026-10-30]: pulsar una palabra abre su ficha (la coloca la página con `el`) · las palabras del banco se resaltan: punteado = aprendiendo, continuo = aprendida (no solo color, WCAG 1.4.1)
// [ReadingSentenceComponent · Presentación · Lectura · 2026-10-25]: UNA frase del lector — palabras con la activa resaltada (<mark>), marcador de lectura e IPA (palabra a palabra con <ruby> si encaja; si no, la de la frase)
// [2026-10-28]: la traducción YA NO va en línea → la pinta ReadingTranslationPaneComponent en la columna derecha, sincronizada por `position`
// [Patrón]: Presentational Component (sin estado ni servicios) | [Principio]: SRP + DRY (prosa y verso usan la misma frase) | [Paradigma]: Declarativo (signals)
// [A11y]: cada palabra es un <button> nativo (teclado + lector de pantalla) dentro de la frase · la palabra activa usa <mark> (semántico, no solo color) · `lang` en el original
// [Modo]: `block` = frase en su propia línea (con IPA visible) · inline = prosa corrida (lectura natural)

export interface WordPick {
  word: number; // Índice de la palabra en la frase
  text: string;
  el: HTMLElement; // Botón pulsado → posición de la ficha y destino del foco al cerrar
}

@Component({
  selector: 'aula-reading-sentence',
  imports: [IconComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "block() ? 'block' : 'inline'" },
  template: `
    <span
      [id]="'sentence-' + sentence().position"
      [attr.aria-current]="active() ? 'true' : null"
      [class]="
        'rounded px-0.5 transition-colors ' +
        (highlight() && active() ? 'bg-tone-brand-soft ring-1 ring-tone-brand-line' : '') +
        (block() ? ' block py-1' : '')
      "
    >
      <!-- [2026-11-06 · IPA por palabra]: <ruby> con la IPA DEBAJO de cada palabra (ruby-position: under) → todos los renglones iguales, se parta donde se parta la línea -->
      @if (block()) {
        <span [attr.lang]="language()" class="leading-[2.6]">
          @for (t of tokens(); track $index) {
            @if (t.word < 0) {
              <ng-container *ngTemplateOutlet="tok; context: { $implicit: t }" />
            } @else {
              <ruby class="[ruby-position:under]">
                <ng-container *ngTemplateOutlet="tok; context: { $implicit: t }" />
                <rt class="font-mono text-[0.7em] font-normal text-muted-foreground" lang="und-fonipa">{{ ipaOf()[t.word] }}</rt>
              </ruby>
            }
          }
        </span>
      } @else {
        <span [attr.lang]="language()" class="leading-loose">
          @for (t of tokens(); track $index) {
            <ng-container *ngTemplateOutlet="tok; context: { $implicit: t }" />
          }
        </span>
      }
    </span>
    @if (!block()) {
      <span> </span>
    }
    <!-- [tok]: una palabra (botón → ficha) o un separador | ng-template: el mismo marcado en prosa y por cláusulas (DRY) -->
    <ng-template #tok let-t>
      @if (t.word < 0) {
        <span>{{ t.text }}</span>
      } @else {
        @if (bookmarkWord() === t.word) {
          <aula-icon name="bookmark" [label]="bookmarkLabel()" class="inline size-3.5 align-[-0.1em] text-tone-brand" />
        }
        @let mark = marked()[key(t.text)]?.status;
        <button
          type="button"
          data-reading-word
          aria-haspopup="dialog"
          class="cursor-pointer rounded-sm px-px text-inherit hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
          [class]="mark === 'learning' ? 'bg-tone-warning-soft underline decoration-dotted decoration-2 underline-offset-4' : mark === 'learned' ? 'bg-tone-brand-soft underline decoration-2 underline-offset-4' : ''"
          [attr.aria-label]="t.text"
          [attr.aria-current]="active() && activeWord() === t.word ? 'true' : null"
          (click)="pick.emit({ word: t.word, text: t.text, el: $any($event.currentTarget) })"
        >
          @if (highlight() && active() && activeWord() === t.word) {
            <mark class="rounded-sm bg-tone-warning-soft px-0.5 text-foreground">{{ t.text }}</mark>
          } @else {
            {{ t.text }}
          }
        </button>
      }
    </ng-template>
  `,
})
export class ReadingSentenceComponent {
  readonly sentence = input.required<ReadingSentence>();
  readonly tokens = input.required<readonly Token[]>();
  readonly language = input('en');
  readonly active = input(false);
  readonly activeWord = input(-1);
  readonly bookmarkWord = input(-1); // Palabra con el marcador (-1 = no está en esta frase)
  readonly bookmarkLabel = input('');
  readonly showIpa = input(false);
  readonly highlight = input(true); // [2026-11-05]: false = resaltado (frase + palabra) desactivado por el usuario
  readonly accent = input<'uk' | 'us'>('uk'); // Inglés: variante de la IPA
  readonly marked = input<Readonly<Record<string, MarkedWord>>>({}); // Palabras del banco del alumno en este idioma
  readonly pick = output<WordPick>(); // Palabra pulsada → la página abre su ficha y coloca el cursor ahí
  protected readonly key = termKey;

  protected readonly block = computed(() => this.showIpa());
  // [ipa]: inglés US si existe y el acento elegido es US; si no, la variante por defecto
  protected readonly ipa = computed(() => (this.accent() === 'us' && this.sentence().ipaUs ? this.sentence().ipaUs! : this.sentence().ipa));
  protected readonly ipaOf = computed(() => wordIpa(this.tokens(), this.ipa() ?? ''));
}
