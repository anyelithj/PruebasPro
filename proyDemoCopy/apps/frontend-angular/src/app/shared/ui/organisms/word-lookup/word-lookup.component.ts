import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
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
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { DictionaryFacade } from '@core/dictionary/dictionary.facade';
import {
  ipaForAccent,
  segmentWords,
  termKey,
  type WordLookup,
} from '@core/dictionary/dictionary.model';
import { I18nService } from '@core/i18n/i18n.service';
import { WordLookupDirective } from '@shared/directives/word-lookup.directive';
import { IpaLabelComponent } from '@shared/ui/atoms/ipa-label/ipa-label.component';
import { AccentSwitchComponent } from '@shared/ui/molecules/accent-switch/accent-switch.component';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import { WordTokenComponent } from '@shared/ui/molecules/word-token/word-token.component';
// [WordLookupComponent · Organismo · Sprint 10.3 · RF-136/RF-137]: texto con diccionario — cada palabra se pulsa y abre, JUNTO a ella (sin taparla), una ventana compacta con IPA (UK/US en inglés), sonido, traducción al español por defecto, ejemplos plegables y «Aprender» / «Aprendido» | [Patrón]: Smart Organism + Facade (DictionaryFacade de core) | [Principio]: DRY (cualquier funcionalidad lo usa sin importar a otra) + accesibilidad | [Paradigma]: Declarativo + Reactivo (signals)
// [A11y]: ventana `role="dialog"` con nombre; Esc la cierra y devuelve el foco a la palabra; clic fuera también cierra; el texto tiene una sola parada de tabulación (WordLookupDirective) · [Rendimiento]: Intl.Segmenter en el navegador y caché de consultas en la fachada

let uid = 0; // Ids únicos para aria-labelledby cuando hay varios textos en la página

@Component({
  // [Selector doble]: etiqueta para plantillas Angular + atributo para el Angular Element (la etiqueta <aula-word-lookup> ya es el Custom Element registrado → usarla dentro de él lo re-instanciaba sin fin: «Reached the max number of directives»)
  selector: 'aula-word-lookup, [aulaWordText]',
  imports: [IconComponent, 
    WordLookupDirective,
    WordTokenComponent,
    IpaLabelComponent,
    AccentSwitchComponent,
    PronunciationButtonComponent,
  ],
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
              [label]="tx.open"
              [statusLabel]="statusLabel(marks()[i] ?? null)"
              (picked)="toggle(i, $event)"
            />
            @if (active() === i) {
              <span
                role="dialog"
                [attr.aria-labelledby]="headId"
                class="absolute left-0 top-full z-50 mt-1.5 block w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-3 text-left text-sm font-normal text-foreground shadow-xl shadow-primary/10 fade-in"
              >
                <span class="flex items-start justify-between gap-2">
                  <span class="min-w-0">
                    <strong [id]="headId" class="block text-base font-extrabold" [attr.lang]="language()">{{
                      lookup()?.result?.lemma || tok.text
                    }}</strong>
                    <aula-ipa-label [ipa]="ipa()" [language]="language()" />
                  </span>
                  <span class="flex shrink-0 items-center gap-1">
                    <aula-pronunciation-button
                      [text]="tok.text"
                      [language]="language()"
                      [label]="tx.listen.replace('{w}', tok.text)"
                    />
                    <button
                      type="button"
                      class="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      [attr.aria-label]="tx.close"
                      (click)="close(true)"
                    >
                      ✕
                    </button>
                  </span>
                </span>
                @if (language() === 'en') {
                  <span class="mt-1 block"><aula-accent-switch [label]="tx.accent" /></span>
                }
                <span class="mt-2 block" aria-live="polite">
                  @if (loading()) {
                    <span class="text-muted-foreground">{{ tx.loading }}</span>
                  } @else if (failed()) {
                    <span role="alert" class="text-tone-danger">{{ tx.error }}</span>
                  } @else if (lookup(); as r) {
                    <span class="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{{
                      tx.translation
                    }}</span>
                    @if (r.result.translation) {
                      <span class="block font-semibold text-tone-brand" lang="es">{{ r.result.translation }}</span>
                    } @else {
                      <span class="block text-xs text-muted-foreground">{{ tx.noTranslation }}</span>
                    }
                    @if (r.result.examples.length) {
                      <details class="mt-2 rounded-lg bg-muted px-2 py-1">
                        <summary class="cursor-pointer text-xs font-semibold">{{ tx.examples }}</summary>
                        <ul class="mt-1 space-y-1 text-xs">
                          @for (ex of r.result.examples; track ex) {
                            <li [attr.lang]="language()">{{ ex }}</li>
                          }
                        </ul>
                      </details>
                    }
                  }
                </span>
                <span class="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                  @switch (marks()[i]) {
                    @case ('learning') {
                      <span class="badge bg-tone-brand-soft text-tone-brand"><aula-icon name="book-open" /> {{ tx.learning }}</span>
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="dict.busy()" (click)="setLearned(tok.text)">
                        ✓ {{ tx.learned }}
                      </button>
                      <button type="button" class="btn btn-ghost btn-sm" [disabled]="dict.busy()" (click)="unmark(tok.text)">
                        {{ tx.unmark }}
                      </button>
                    }
                    @case ('learned') {
                      <span class="badge bg-tone-info-soft text-tone-info">✓ {{ tx.learned }}</span>
                      <button type="button" class="btn btn-ghost btn-sm" [disabled]="dict.busy()" (click)="unmark(tok.text)">
                        {{ tx.unmark }}
                      </button>
                    }
                    @default {
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="dict.busy()" (click)="learn(tok.text)">
                        ＋ {{ tx.learn }}
                      </button>
                    }
                  }
                </span>
                @if (dict.error()) {
                  <span role="alert" class="mt-1 block text-xs text-tone-danger">{{ dict.error() }}</span>
                }
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
  private readonly speech = inject(SpeechSynthesisService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly text = input('');
  readonly language = input('en');
  protected readonly headId = `aula-word-${++uid}`;

  protected readonly tokens = computed(() => segmentWords(this.text(), this.language()));
  protected readonly firstWord = computed(() => this.tokens().findIndex((t) => t.word));
  // [marks]: estado por índice de token (aprendiendo / aprendida) leído del mapa compartido de la fachada
  protected readonly marks = computed(() => {
    const map = this.dict.marked()[this.language()] ?? {};
    return this.tokens().map((t) => (t.word ? (map[termKey(t.text)]?.status ?? null) : null));
  });
  protected readonly active = signal<number | null>(null);
  protected readonly lookup = signal<WordLookup | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  private opener: HTMLElement | null = null;

  protected readonly ipa = computed(() => {
    const r = this.lookup()?.result;
    return r ? ipaForAccent(this.language(), this.speech.accent(), r) : null;
  });

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

  // [toggle]: abre la ventana de la palabra (o la cierra si ya estaba abierta) y consulta con la frase como contexto
  protected async toggle(i: number, target: EventTarget | null): Promise<void> {
    if (this.active() === i) return this.close(true);
    this.opener = target as HTMLElement | null;
    this.active.set(i);
    this.lookup.set(null);
    this.failed.set(false);
    this.loading.set(true);
    const word = this.tokens()[i].text;
    const r = await this.dict.lookup(this.language(), word, this.sentenceOf(i));
    if (this.active() !== i) return; // El usuario ya abrió otra palabra
    this.loading.set(false);
    this.failed.set(!r);
    this.lookup.set(r);
  }

  protected close(restoreFocus = false): void {
    if (this.active() === null) return;
    this.active.set(null);
    if (restoreFocus) this.opener?.focus(); // [A11y]: el foco vuelve a la palabra consultada
  }

  protected onDocClick(e: MouseEvent): void {
    if (!this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  protected learn(word: string): void {
    const i = this.active();
    void this.dict.markToLearn(this.language(), word, this.lookup(), i === null ? '' : this.sentenceOf(i));
  }
  protected setLearned(word: string): void {
    void this.dict.setStatus(this.language(), word, 'learned');
  }
  protected unmark(word: string): void {
    void this.dict.unmark(this.language(), word);
  }

  // [sentenceOf]: frase que contiene la palabra (traducción según el contexto) | `Intl.Segmenter` por frases o el texto entero
  private sentenceOf(i: number): string {
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
