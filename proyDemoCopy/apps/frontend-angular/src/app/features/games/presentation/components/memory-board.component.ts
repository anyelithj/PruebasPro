import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { shuffle, type VocabItem } from '../../domain/models/games';
// [MemoryBoardComponent · Presentacional · Sprint 8.8]: tablero de parejas palabra ↔ imagen (emoji) o traducción | [Patrón]: State Machine (0, 1 o 2 cartas volteadas → pareja / sin pareja) + Presentational Component | [Principio]: SRP (la página envía la ronda) | [Paradigma]: Reactivo (signals)
// [A11y]: cada carta es un <button> con nombre («Carta 3, boca abajo» / su contenido), `aria-pressed` cuando está volteada, emparejadas deshabilitadas con ✓ en texto · teclado: Tab + Enter/Espacio

interface MemoryCard {
  readonly id: number; // Posición en el tablero (estable para `track`)
  readonly pair: number; // Índice de la palabra en el vocabulario de la partida
  readonly face: string; // Lo que se ve al voltearla
  readonly isTerm: boolean; // true = palabra · false = imagen o traducción
}

@Component({
  selector: 'aula-memory-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <p class="mb-3 text-sm font-semibold" aria-live="polite">{{ leftLabel() }}</p>
    <div class="mx-auto grid max-w-2xl grid-cols-3 gap-2 sm:grid-cols-4">
      @for (c of cards(); track c.id) {
        @let open = flipped().includes(c.id) || matched().has(c.pair);
        <button
          type="button"
          class="grid aspect-square place-items-center rounded-xl border-2 p-2 text-center text-sm font-bold transition-all sm:text-base"
          [class]="
            matched().has(c.pair)
              ? 'border-transparent bg-tone-brand-soft text-tone-brand'
              : open
                ? 'border-primary bg-card'
                : 'border-border bg-gradient-brand text-white hover:-translate-y-0.5'
          "
          [attr.aria-pressed]="open"
          [attr.aria-label]="
            open ? c.face + (matched().has(c.pair) ? ' ✓' : '') : faceDownLabel(c.id + 1)
          "
          [disabled]="matched().has(c.pair) || busy()"
          (click)="flip(c)"
        >
          @if (open) {
            <span
              [class.text-4xl]="!c.isTerm && isEmoji(c.face)"
              [attr.lang]="c.isTerm ? language() : null"
              >{{ c.face }}</span
            >
            @if (matched().has(c.pair)) {
              <span class="sr-only">✓</span>
            }
          } @else {
            <span aria-hidden="true" class="text-2xl">?</span>
          }
        </button>
      }
    </div>
  `,
})
export class MemoryBoardComponent {
  readonly items = input.required<VocabItem[]>();
  readonly language = input('en');
  readonly busy = input(false);
  readonly faceDownText = input('Carta {n}, boca abajo');
  readonly pairsLeftText = input('Parejas por encontrar: {n}');
  readonly attempt = output<{ pair: number; correct: boolean; answer: string }>(); // La página envía la ronda
  readonly completed = output<void>();

  protected readonly cards = signal<MemoryCard[]>([]);
  protected readonly flipped = signal<number[]>([]); // ids volteados (máx. 2)
  protected readonly matched = signal(new Set<number>());
  protected readonly leftLabel = computed(() =>
    this.pairsLeftText().replace('{n}', String(this.items().length - this.matched().size)),
  );

  constructor() {
    // [Reparto]: cada palabra genera dos cartas (palabra + emoji/traducción) y se barajan
    effect(() => {
      const items = this.items();
      untracked(() => {
        const deck = items.flatMap((it, i) => [
          { pair: i, face: it.term, isTerm: true },
          { pair: i, face: it.emoji || it.translation || it.term, isTerm: false },
        ]);
        this.cards.set(shuffle(deck).map((c, id) => ({ ...c, id })));
        this.flipped.set([]);
        this.matched.set(new Set());
      });
    });
  }

  protected faceDownLabel(n: number): string {
    return this.faceDownText().replace('{n}', String(n));
  }

  // `\p{Extended_Pictographic}` (Unicode property escape, ES2018): ¿la cara es un emoji? → se pinta grande
  protected isEmoji(s: string): boolean {
    return /\p{Extended_Pictographic}/u.test(s);
  }

  protected flip(card: MemoryCard): void {
    const open = this.flipped();
    if (open.includes(card.id) || open.length === 2) return;
    const next = [...open, card.id];
    this.flipped.set(next);
    if (next.length < 2) return;
    const [a, b] = next.map((id) => this.cards().find((c) => c.id === id)!);
    const correct = a.pair === b.pair && a.isTerm !== b.isTerm;
    const term = (a.isTerm ? a : b).face;
    this.attempt.emit({
      pair: a.isTerm ? a.pair : b.pair,
      correct,
      answer: correct ? term : `${a.face} ≠ ${b.face}`,
    });
    // [Pausa]: deja ver la segunda carta 0,9 s antes de taparlas (o fijarlas si son pareja)
    setTimeout(() => {
      if (correct) this.matched.update((m) => new Set(m).add(a.pair));
      this.flipped.set([]);
      if (this.matched().size === this.items().length) this.completed.emit();
    }, 900);
  }
}
