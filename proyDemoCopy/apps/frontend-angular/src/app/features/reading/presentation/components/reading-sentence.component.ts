import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ipaWords, type ReadingSentence, type Token } from '../../domain/models/reading';
// [ReadingSentenceComponent · Presentación · Lectura · 2026-10-25]: UNA frase del lector — palabras con la activa resaltada (<mark>), marcador de lectura, IPA (palabra a palabra con <ruby> si encaja; si no, la de la frase) y traducción
// [Patrón]: Presentational Component (sin estado ni servicios) | [Principio]: SRP + DRY (prosa y verso usan la misma frase) | [Paradigma]: Declarativo (signals)
// [A11y]: cada palabra es un <button> nativo (teclado + lector de pantalla) dentro de la frase · la palabra activa usa <mark> (semántico, no solo color) · `lang` en el original y «es» en la traducción
// [Modo]: `block` = frase en su propia línea (con IPA o traducción visibles) · inline = prosa corrida (lectura natural)

@Component({
  selector: 'aula-reading-sentence',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "block() ? 'block' : 'inline'" },
  template: `
    <span
      [id]="'sentence-' + sentence().position"
      [class]="
        'rounded px-0.5 transition-colors ' +
        (active() ? 'bg-tone-brand-soft ring-1 ring-tone-brand-line' : '') +
        (block() ? ' block py-1' : '')
      "
    >
      <span [attr.lang]="language()" class="leading-loose">
        @for (t of tokens(); track $index) {
          @if (t.word < 0) {
            <span>{{ t.text }}</span>
          } @else {
            @if (bookmarkWord() === t.word) {
              <aula-icon name="bookmark" [label]="bookmarkLabel()" class="inline size-3.5 align-[-0.1em] text-tone-brand" />
            }
            <button
              type="button"
              class="cursor-pointer rounded-sm px-px text-inherit hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              [attr.aria-label]="t.text"
              [attr.aria-current]="active() && activeWord() === t.word ? 'true' : null"
              (click)="pick.emit(t.word)"
            >
              @if (rubies(); as r) {
                <ruby>
                  @if (active() && activeWord() === t.word) {
                    <mark class="rounded-sm bg-tone-warning-soft px-0.5 text-foreground">{{ t.text }}</mark>
                  } @else {
                    {{ t.text }}
                  }
                  <rt class="font-mono text-[0.6em] text-muted-foreground">{{ r[t.word] }}</rt>
                </ruby>
              } @else if (active() && activeWord() === t.word) {
                <mark class="rounded-sm bg-tone-warning-soft px-0.5 text-foreground">{{ t.text }}</mark>
              } @else {
                {{ t.text }}
              }
            </button>
          }
        }
      </span>
      @if (showIpa() && !rubies() && ipa()) {
        <span class="block font-mono text-xs text-muted-foreground">/{{ ipa() }}/</span>
      }
      @if (showTranslation() && sentence().translation) {
        <span lang="es" class="block text-sm italic text-muted-foreground">{{ sentence().translation }}</span>
      }
    </span>
    @if (!block()) {
      <span> </span>
    }
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
  readonly showTranslation = input(false);
  readonly accent = input<'uk' | 'us'>('uk'); // Inglés: variante de la IPA
  readonly pick = output<number>(); // Palabra pulsada → la página salta ahí (o pone el marcador)

  protected readonly block = computed(() => this.showIpa() || this.showTranslation());
  // [ipa]: inglés US si existe y el acento elegido es US; si no, la variante por defecto
  protected readonly ipa = computed(() => (this.accent() === 'us' && this.sentence().ipaUs ? this.sentence().ipaUs! : this.sentence().ipa));
  protected readonly rubies = computed(() => (this.showIpa() ? ipaWords(this.ipa(), this.tokens()) : null));
}
