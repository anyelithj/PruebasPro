import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { SpeechSynthesisService } from '@core/audio/speech-synthesis.service';
import { DictionaryFacade } from '@core/dictionary/dictionary.facade';
import type { WordLookup, WordStatus } from '@core/dictionary/dictionary.model';
import { I18nService } from '@core/i18n/i18n.service';
import { AccentSwitchComponent } from '@shared/ui/molecules/accent-switch/accent-switch.component';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
// [WordCardComponent · Organismo · 2026-10-30 → 2026-10-31]: ficha de una palabra — sonido, IPA (UK/US en inglés), traducción al español según la frase y «Aprendido» | «Aprender»
// [Fix 2026-10-31]: MISMO diseño que el diccionario de Cursos (Next.js components/reading/WordCard.tsx): centrada, pie a dos colores y flecha hacia la palabra
// Extraída de WordLookupComponent para reutilizarla en el lector de Lectura (antes pulsar una palabra allí solo movía el cursor) | Quien la usa decide dónde se coloca
// [Patrón]: Smart Component + Facade (DictionaryFacade, con caché de consultas) | [Principio]: SRP + DRY | [Paradigma]: Declarativo + Reactivo (signals) + async/await
// [A11y]: `role="dialog"` con nombre · resultado en `aria-live` · `lang` en la palabra y en la traducción

// [placeWordCard]: encima de la palabra si cabe (crece hacia arriba con `bottom`, sin medir la ficha) y si no, debajo | la flecha apunta al centro de la palabra | `Math.min/max`: siempre dentro de la pantalla | Función pura
export interface WordCardPlace {
  left: number;
  top: string;
  bottom: string;
  above: boolean;
  arrow: number;
}
export function placeWordCard(r: Pick<DOMRect, 'left' | 'top' | 'bottom' | 'width'>, vw = innerWidth, vh = innerHeight): WordCardPlace {
  const [edge, gap, h] = [8, 12, 200];
  const w = Math.min(280, vw - edge * 2);
  const center = r.left + r.width / 2;
  const left = Math.min(Math.max(center - w / 2, edge), vw - w - edge);
  const above = r.top - h - gap >= edge;
  return {
    left,
    above,
    top: above ? 'auto' : `${Math.min(r.bottom + gap, vh - h - edge)}px`,
    bottom: above ? `${vh - r.top + gap}px` : 'auto',
    arrow: Math.max(12, Math.min(center - left, w - 12)),
  };
}

let uid = 0; // Id único para aria-labelledby cuando hay varias fichas en la página

@Component({
  selector: 'aula-word-card',
  imports: [PronunciationButtonComponent, AccentSwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let tx = i18n.t().dictionary;
    <span
      role="dialog"
      [attr.aria-labelledby]="headId"
      class="relative block w-[280px] max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-card text-sm font-normal text-foreground shadow-2xl fade-in"
    >
      <button
        type="button"
        class="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        [attr.aria-label]="tx.close"
        (click)="closed.emit()"
      >
        ✕
      </button>
      <span class="block space-y-1.5 px-8 pb-3 pt-4 text-center">
        <span class="flex items-center justify-center gap-2">
          <aula-pronunciation-button [text]="word()" [language]="language()" [label]="tx.listen.replace('{w}', word())" />
          <strong [id]="headId" class="min-w-0 break-words text-xl font-medium leading-tight" [attr.lang]="language()">{{ word() }}</strong>
        </span>
        @if (language() === 'en') {
          <span class="block"><aula-accent-switch [label]="tx.accent" /></span>
        }
        <!-- [Fix 2026-10-31]: IPA al instante (sin esperar a la IA) y rótulos visibles, igual que Cursos -->
        <span class="block space-y-1" aria-live="polite">
          @if (ipa(); as line) {
            <span class="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ tx.ipaLabel }}</span>
            <span class="eeg-mono block text-[13px] text-muted-foreground">{{ line }}</span>
          }
          <span class="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{{ tx.translationLabel }}</span>
          @if (loading()) {
            <span class="block animate-pulse type-meta text-muted-foreground">{{ tx.translating }}</span>
          } @else if (lookup()?.result?.translation; as text) {
            <span class="block text-lg leading-snug" lang="es">{{ text }}</span>
          } @else {
            <span class="block type-meta text-muted-foreground">
              {{ failed() ? tx.error : tx.noTranslation }}
              <button type="button" class="font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" (click)="attempt.set(attempt() + 1)">{{ tx.retry }}</button>
            </span>
          }
        </span>
        @if (dict.error()) {
          <span role="alert" class="block type-meta text-tone-danger">{{ dict.error() }}</span>
        }
      </span>
      <!-- [Pie a dos colores · 2026-11-06]: «Ya la sé» | «Repasar» | aria-pressed + ✓: el estado no depende solo del color (WCAG 1.4.1) | pulsar el activo quita la marca -->
      <span class="grid grid-cols-2 overflow-hidden rounded-b-2xl">
        <button type="button" class="inline-flex min-h-11 items-center justify-center gap-1 bg-emerald-400 px-2 py-2.5 text-sm font-semibold text-emerald-950 transition-colors hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60" [disabled]="dict.busy()" [attr.aria-pressed]="status() === 'learned'" (click)="choose('learned')">
          @if (status() === 'learned') { ✓ {{ tx.known }} } @else { {{ tx.knowIt }} }
        </button>
        <button type="button" class="inline-flex min-h-11 items-center justify-center gap-1 bg-amber-300 px-2 py-2.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60" [disabled]="dict.busy()" [attr.aria-pressed]="status() === 'learning'" (click)="choose('learning')">
          @if (status() === 'learning') { ✓ {{ tx.inReview }} } @else { {{ tx.review }} }
        </button>
      </span>
      <!-- [Flecha]: cuadrado girado 45° que apunta a la palabra | decorativa | -z-10: bajo el contenido -->
      @if (arrow() !== null) {
        <span aria-hidden="true" class="absolute -z-10 size-3 rotate-45" [class]="arrowClass()" [style.left.px]="arrow()! - 6"></span>
      }
    </span>
  `,
})
export class WordCardComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly dict = inject(DictionaryFacade);
  private readonly speech = inject(SpeechSynthesisService);
  readonly word = input.required<string>();
  readonly language = input('en');
  readonly sentence = input(''); // Frase de contexto → traducción según el contexto y ejemplo al guardar
  readonly arrow = input<number | null>(null); // Posición de la flecha (px) · null = sin flecha (<aula-word-lookup>)
  readonly above = input(false); // La ficha está encima de la palabra → la flecha sale del pie
  readonly closed = output<void>(); // `output` (Angular): quien la abrió decide cómo cerrarla
  protected readonly headId = `aula-word-${++uid}`;
  protected readonly lookup = signal<WordLookup | null>(null);
  protected readonly fastIpa = signal<{ ipa: string | null; ipa_us: string | null } | null>(null); // IPA sin esperar a la IA
  protected readonly attempt = signal(0); // «Reintentar» vuelve a preguntar a la IA
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly status = computed(() => this.dict.statusOf(this.language(), this.word())?.status ?? null);
  // [ipa · 2026-10-31]: variante del acento elegido (inglés) o la única del idioma; de la consulta completa o, mientras llega, de la rápida (igual que Cursos)
  protected readonly ipa = computed(() => {
    const [r, f] = [this.lookup()?.result, this.fastIpa()];
    const uk = r?.ipa_uk ?? r?.ipa ?? f?.ipa;
    const us = r?.ipa_us ?? f?.ipa_us;
    const one = this.language() === 'en' && this.speech.accent() === 'us' ? (us ?? uk) : (uk ?? us);
    return one ? (one.startsWith('/') || one.startsWith('[') ? one : `/${one}/`) : null;
  });
  // [arrowClass]: encima → toma el color del botón que tiene detrás (verde a la izquierda, amarillo a la derecha); debajo → color de la ficha
  protected readonly arrowClass = computed(() =>
    this.above() ? `-bottom-1.5 ${(this.arrow() ?? 0) < 140 ? 'bg-emerald-400' : 'bg-amber-300'}` : '-top-1.5 border-l border-t border-border bg-card',
  );

  constructor() {
    // [Consulta]: al abrir o cambiar de palabra | `gen` (Generation Token): una respuesta tardía de la palabra anterior se ignora
    let gen = 0;
    effect(() => {
      const [word, language, sentence] = [this.word(), this.language(), this.sentence()];
      this.attempt(); // Dependencia: «Reintentar» repite la consulta
      const mine = ++gen;
      untracked(() => {
        this.lookup.set(null);
        this.failed.set(false);
        this.loading.set(true);
      });
      void this.dict.ipa(language, word).then((f) => {
        if (mine === gen) this.fastIpa.set(f);
      });
      void this.dict.lookup(language, word, sentence).then((r) => {
        if (mine !== gen) return;
        this.loading.set(false);
        this.failed.set(!r);
        this.lookup.set(r);
      });
    });
  }

  // [choose]: pulsar el estado activo lo quita · sin marca → primero se crea (con traducción y frase) y luego se fija el estado | `async/await` (ES2017)
  protected async choose(target: WordStatus): Promise<void> {
    const [language, word, current] = [this.language(), this.word(), this.status()];
    if (current === target) return void this.dict.unmark(language, word);
    if (!current && !(await this.dict.markToLearn(language, word, this.lookup(), this.sentence()))) return;
    if (current || target === 'learned') await this.dict.setStatus(language, word, target); // `markToLearn` ya deja «learning»
  }
}
