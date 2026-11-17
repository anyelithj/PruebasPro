import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DictionaryFacade } from '@core/dictionary/dictionary.facade';
import { segmentWords, termKey } from '@core/dictionary/dictionary.model';
import { I18nService } from '@core/i18n/i18n.service';
import { WordLookupDirective } from '@shared/directives/word-lookup.directive';
import { WordTokenComponent } from '@shared/ui/molecules/word-token/word-token.component';
import { WordCardComponent } from './word-card.component'; // [2026-10-30]: la ficha de la palabra, compartida con el lector de Lectura
// [WordLookupComponent · Organismo · Sprint 10.3 · RF-136/RF-137]: texto con diccionario — cada palabra se pulsa y abre, JUNTO a ella (sin taparla), una ventana compacta con IPA (UK/US en inglés), sonido, traducción al español por defecto, ejemplos plegables y «Aprender» / «Aprendido» | [Patrón]: Smart Organism + Facade (DictionaryFacade de core) | [Principio]: DRY (cualquier funcionalidad lo usa sin importar a otra) + accesibilidad | [Paradigma]: Declarativo + Reactivo (signals)
// [A11y]: ventana `role="dialog"` con nombre; Esc la cierra y devuelve el foco a la palabra; clic fuera también cierra; el texto tiene una sola parada de tabulación (WordLookupDirective) · [Rendimiento]: Intl.Segmenter en el navegador y caché de consultas en la fachada

@Component({
  // [Selector doble]: etiqueta para plantillas Angular + atributo para el Angular Element (la etiqueta <aula-word-lookup> ya es el Custom Element registrado → usarla dentro de él lo re-instanciaba sin fin: «Reached the max number of directives»)
  selector: 'aula-word-lookup, [aulaWordText]',
  imports: [WordLookupDirective, WordTokenComponent, WordCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'close(true)',
    '(document:click)': 'onDocClick($event)',
  },
  template: `
    @let tx = i18n.t().dictionary;
    <span aulaWordLookup role="group" [attr.aria-label]="tx.textLabel" [attr.lang]="language()">
      @for (tok of tokens(); track $index; let i = $index) {
        @if (tok.word) {
          <span class="relative inline">
            <aula-word-token
              [text]="tok.text"
              [language]="language()"
              [first]="i === firstWord()"
              [open]="active() === i"
              [status]="marks()[i] ?? null"
              [focused]="focusAt()[i]"
              [label]="tx.open"
              [statusLabel]="statusLabel(marks()[i] ?? null)"
              (picked)="toggle(i, $event)"
            />
            @if (active() === i) {
              <span class="absolute left-0 top-full z-50 mt-1.5 block">
                <aula-word-card [word]="tok.text" [language]="language()" [sentence]="sentenceOf(i)" (closed)="close(true)" />
              </span>
            }
          </span>
        } @else {
          <span>{{ tok.text }}</span>
        }
      }
    </span>
  `,
})
export class WordLookupComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly dict = inject(DictionaryFacade);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly text = input('');
  readonly language = input('en');
  // [ruleWords · 2026-11-14]: palabras que ilustran la regla (p. ej. las del sonido /ɒ/), separadas por comas · '' o lista → modo «regla»:
  // se resaltan SOLO esas y se ocultan las marcas «aprender/aprendido» del usuario (antes «I» o «some» salían resaltadas en fichas de pronunciación) | null = modo normal
  readonly ruleWords = input<string | null>(null);

  private readonly focusSet = computed(() => {
    const f = this.ruleWords();
    return f === null ? null : new Set(f.split(',').map((w) => termKey(w.trim())).filter(Boolean));
  });
  protected readonly focusAt = computed(() => {
    const set = this.focusSet();
    return this.tokens().map((t) => !!set && t.word && set.has(termKey(t.text)));
  });

  protected readonly tokens = computed(() => segmentWords(this.text(), this.language()));
  protected readonly firstWord = computed(() => this.tokens().findIndex((t) => t.word));
  // [marks]: estado por índice de token (aprendiendo / aprendida) leído del mapa compartido de la fachada
  protected readonly marks = computed(() => {
    if (this.focusSet()) return []; // Modo «regla»: sin marcas del usuario
    const map = this.dict.marked()[this.language()] ?? {};
    return this.tokens().map((t) => (t.word ? (map[termKey(t.text)]?.status ?? null) : null));
  });
  protected readonly active = signal<number | null>(null);
  private opener: HTMLElement | null = null;

  constructor() {
    // [Resaltado]: carga una vez por idioma las palabras marcadas del usuario
    effect(() => {
      const lang = this.language();
      untracked(() => void this.dict.loadMarked(lang));
    });
  }

  protected statusLabel(s: string | null): string {
    const tx = this.i18n.t().dictionary;
    return s === 'learning' ? tx.learning : s === 'learned' ? tx.learned : '';
  }

  // [toggle]: abre la ficha de la palabra (la consulta la hace WordCard) o la cierra si ya estaba abierta
  protected toggle(i: number, target: EventTarget | null): void {
    if (this.active() === i) return this.close(true);
    this.opener = target as HTMLElement | null;
    this.active.set(i);
  }

  protected close(restoreFocus = false): void {
    if (this.active() === null) return;
    this.active.set(null);
    if (restoreFocus) this.opener?.focus(); // [A11y]: el foco vuelve a la palabra consultada
  }

  protected onDocClick(e: MouseEvent): void {
    if (!this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  // [sentenceOf]: frase que contiene la palabra (traducción según el contexto) | `Intl.Segmenter` por frases o el texto entero
  protected sentenceOf(i: number): string {
    const toks = this.tokens();
    const offset = toks.slice(0, i).reduce((n, t) => n + t.text.length, 0);
    const text = this.text();
    const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
    if (Seg)
      for (const s of new Seg(this.language(), { granularity: 'sentence' }).segment(text))
        if (offset >= s.index && offset < s.index + s.segment.length) return s.segment.trim().slice(0, 400);
    return text.slice(0, 400);
  }
}
