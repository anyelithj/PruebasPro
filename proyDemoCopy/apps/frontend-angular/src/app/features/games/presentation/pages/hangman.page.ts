import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { GamesFacade } from '../../application/games.facade';
import { GameShellComponent } from '../components/game-shell.component';
// [HangmanPage · Presentación · 2026-11-06]: /juegos/ahorcado — adivinar cada palabra del mazo letra a letra con su traducción (y emoji) como pista; 6 fallos = palabra perdida
// [Ronda]: acertada → `answer = término` · perdida → lo descubierto (incorrecta) | NestJS evalúa con `expected: 'term'` como Parejas | al acabar el mazo termina la partida
// [A11y]: teclado en pantalla con <button> nativos + teclado físico · progreso y resultado en aria-live · el dibujo es decorativo (los fallos también van en texto)

const MAX_MISSES = 6;
const norm = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase(); // Sin tildes: «á» se descubre con «a»

@Component({
  selector: 'aula-hangman-page',
  imports: [GameShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    @let tx = i18n.t().games;
    <aula-game-shell [type]="'hangman'" [lang]="lang()" [lvl]="level()" [diff]="d()">
      @if (item(); as it) {
        <div class="grid items-center gap-6 md:grid-cols-[12rem_1fr]">
          <!-- Dibujo: cada fallo añade una pieza -->
          <svg viewBox="0 0 120 140" class="mx-auto h-40 w-auto text-foreground" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round">
            <path d="M10 130h60M30 130V10h50v18" class="text-muted-foreground" />
            @if (misses() > 0) {
              <circle cx="80" cy="40" r="12" />
            }
            @if (misses() > 1) {
              <path d="M80 52v38" />
            }
            @if (misses() > 2) {
              <path d="M80 62l-16 14" />
            }
            @if (misses() > 3) {
              <path d="M80 62l16 14" />
            }
            @if (misses() > 4) {
              <path d="M80 90l-14 22" />
            }
            @if (misses() > 5) {
              <path d="M80 90l14 22" />
            }
          </svg>
          <div class="space-y-4 text-center md:text-left">
            <p class="text-lg">
              @if (it.emoji) {
                <span aria-hidden="true" class="mr-1">{{ it.emoji }}</span>
              }
              <span lang="es" class="font-semibold">{{ it.translation || '…' }}</span>
            </p>
            <p class="font-mono text-3xl font-bold tracking-[0.35em]" [attr.lang]="games.session()?.language" aria-live="polite">
              @for (c of chars(); track $index) {
                <span>{{ c }}</span>
              }
            </p>
            <p class="type-meta text-muted-foreground" aria-live="polite">{{ i18n.fmt(tx.hangmanMisses, { n: misses(), max: max }) }}</p>
            @if (state() !== 'playing') {
              <div role="status" class="space-y-2">
                <p class="font-bold" [class.text-tone-brand]="state() === 'won'" [class.text-tone-danger]="state() === 'lost'">
                  {{ state() === 'won' ? tx.hangmanWon : i18n.fmt(tx.hangmanLost, { word: it.term }) }}
                </p>
                <button type="button" class="btn btn-primary" [disabled]="games.busy()" (click)="next()">{{ tx.hangmanNext }} →</button>
              </div>
            } @else {
              <div class="flex flex-wrap justify-center gap-1.5 md:justify-start" role="group" [attr.aria-label]="tx.hangmanKeyboard">
                @for (k of keys(); track k) {
                  <button
                    type="button"
                    class="grid size-10 place-items-center rounded-lg border border-border font-semibold uppercase transition-colors hover:bg-muted disabled:opacity-40"
                    [class.bg-tone-brand-soft]="tried().has(k) && inWord(k)"
                    [class.line-through]="tried().has(k) && !inWord(k)"
                    [disabled]="tried().has(k)"
                    (click)="guess(k)"
                  >
                    {{ k }}
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }
    </aula-game-shell>
  `,
})
export default class HangmanPage {
  protected readonly i18n = inject(I18nService);
  protected readonly games = inject(GamesFacade);
  readonly lang = input<string>();
  readonly level = input<string>();
  readonly d = input<string>();
  protected readonly max = MAX_MISSES;
  private readonly items = computed(() => this.games.session()?.content.vocabulary ?? []);
  protected readonly index = signal(0);
  protected readonly tried = signal<ReadonlySet<string>>(new Set());
  protected readonly item = computed(() => this.items()[this.index()] ?? null);
  private readonly word = computed(() => norm(this.item()?.term ?? ''));
  protected readonly misses = computed(() => [...this.tried()].filter((k) => !this.word().includes(k)).length);
  protected readonly state = computed<'playing' | 'won' | 'lost'>(() => {
    const letters = [...this.word()].filter((c) => /\p{L}/u.test(c));
    if (letters.length && letters.every((c) => this.tried().has(c))) return 'won';
    return this.misses() >= MAX_MISSES ? 'lost' : 'playing';
  });
  // [chars]: letra descubierta o «_» · espacios, guiones y apóstrofos se ven desde el principio · perdida → la palabra entera
  protected readonly chars = computed(() =>
    [...(this.item()?.term ?? '')].map((c) =>
      /\p{L}/u.test(c) && !this.tried().has(norm(c)) && this.state() !== 'lost' ? '_' : c === ' ' ? ' ' : c,
    ),
  );
  // [keys]: abecedario latino + letras propias del término (ñ, ß, ç…)
  protected readonly keys = computed(() => {
    const own = [...this.word()].filter((c) => /\p{L}/u.test(c));
    return [...new Set([...'abcdefghijklmnopqrstuvwxyz', ...own])].sort((a, b) => a.localeCompare(b));
  });
  private reported = -1; // Ronda ya enviada (no se envía dos veces)

  protected inWord(k: string): boolean {
    return this.word().includes(k);
  }

  protected guess(k: string): void {
    if (this.state() !== 'playing' || this.tried().has(k)) return;
    const shown = this.chars().join(''); // Lo descubierto ANTES de perder (para la ronda incorrecta)
    this.tried.update((t) => new Set(t).add(k));
    const st = this.state();
    if (st === 'playing' || this.reported === this.index()) return;
    this.reported = this.index();
    const it = this.item()!;
    void this.games.answer({ answer: st === 'won' ? it.term : shown, entryIndex: this.index(), expected: 'term' });
  }

  protected next(): void {
    if (this.index() + 1 >= this.items().length) return void this.games.finish();
    this.index.update((i) => i + 1);
    this.tried.set(new Set());
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target as HTMLElement | null)?.closest?.('input, textarea, select, button')) return;
    if (e.key === 'Enter' && this.state() !== 'playing') return this.next();
    const k = norm(e.key);
    if (k.length === 1 && /\p{L}/u.test(k)) this.guess(k);
  }
}
