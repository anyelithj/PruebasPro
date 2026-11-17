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
// [2026-11-14 · como el memo de 50languages]: las DOS cartas de la pareja llevan la MISMA imagen + su texto (una en el idioma meta, otra en español)
// → el estudiante empareja por sentido y no adivina a qué palabra corresponde una imagen ambigua
// [A11y]: cada carta es un <button> con nombre («Carta 3, boca abajo» / su contenido), `aria-pressed` cuando está volteada, emparejadas deshabilitadas con ✓ en texto · teclado: Tab + Enter/Espacio

interface MemoryCard {
  readonly id: number; // Posición en el tablero (estable para `track`)
  readonly pair: number; // Índice de la palabra en el vocabulario de la partida
  readonly face: string; // Texto de la carta: palabra en el idioma que se aprende o su traducción al español
  readonly isTerm: boolean; // true = palabra (idioma meta) · false = traducción (español)
  readonly image?: string; // [2026-11-03]: imagen del mazo
  readonly emoji?: string; // [2026-11-14]: emoji si no hay imagen
}

@Component({
  selector: 'aula-memory-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <p class="mb-3 font-semibold" aria-live="polite">{{ leftLabel() }}</p>
    <!-- [Rejilla responsive · 2026-10-27]: 3 columnas en móvil · 4 en tableta (md) · 6 en escritorio (lg+) → antes 4 cartas cuadradas enormes por fila | Tailwind breakpoints md/lg (mobile-first) -->
    <div class="mx-auto grid max-w-5xl grid-cols-3 gap-2 md:grid-cols-4 lg:grid-cols-6 lg:gap-3">
      @for (c of cards(); track c.id) {
        @let open = flipped().includes(c.id) || matched().has(c.pair);
        <button
          type="button"
          class="grid aspect-[4/3] min-h-16 place-items-center overflow-hidden rounded-xl border-2 p-1.5 text-center text-xs font-bold leading-tight break-words transition-all hyphens-auto sm:text-sm"
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
            <!-- [Cara]: imagen (o emoji) arriba + texto abajo · \`lang\` (HTML): pronunciación correcta en lectores de pantalla -->
            <span class="flex h-full w-full flex-col items-center justify-center gap-1">
              @if (c.image) {
                <img [src]="c.image" alt="" class="min-h-0 w-full flex-1 object-contain" referrerpolicy="no-referrer" />
              } @else if (c.emoji) {
                <span aria-hidden="true" class="text-2xl leading-none sm:text-3xl">{{ c.emoji }}</span>
              }
              <span [attr.lang]="c.isTerm ? language() : 'es'" [class]="c.isTerm ? '' : 'font-semibold text-muted-foreground'">{{ c.face }}</span>
            </span>
            @if (matched().has(c.pair)) {
              <span class="sr-only">✓</span>
            }
          } @else {
            <span aria-hidden="true" class="text-xl">?</span>
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
    // [Reparto]: cada palabra genera dos cartas con la MISMA imagen: palabra (idioma meta) + traducción (español); se barajan
    // Sin traducción, la segunda carta usa el emoji como texto (comportamiento anterior) para que la pareja siga siendo distinguible
    effect(() => {
      const items = this.items();
      untracked(() => {
        const deck = items.flatMap((it, i) => [
          { pair: i, face: it.term, isTerm: true, image: it.image, emoji: it.emoji },
          { pair: i, face: it.translation || it.emoji || it.term, isTerm: false, image: it.image, emoji: it.translation ? it.emoji : undefined },
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
