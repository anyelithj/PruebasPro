import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  viewChild,
} from '@angular/core';
import type { ChatTurn } from '../../domain/models/assistant';
// [ConversationChatComponent · Presentación]: lista de turnos con la respuesta en streaming | [Patrón]: Presentational Component (solo inputs) | [Principio]: SRP | [Paradigma]: Declarativo + Reactivo (effect para el autoscroll)
// [Color por nivel · Sprint 7.8]: lee `--lvl`/`--lvl-deep` del ancestro con [aulaLevel] (sin él → color primario)
// [A11y]: role="log" + aria-live="polite" → el lector anuncia lo nuevo · cada turno dice quién habla en texto (no solo por alineación/color)

@Component({
  selector: 'aula-conversation-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #scroller
      role="log"
      aria-live="polite"
      [attr.aria-busy]="streaming()"
      class="h-[min(60dvh,32rem)] space-y-3 overflow-y-auto rounded-xl border border-border bg-background p-3 sm:p-4"
      tabindex="0"
      [attr.aria-label]="label()"
    >
      @for (turn of turns(); track $index) {
        <div class="flex" [class.justify-end]="turn.role === 'user'">
          <!-- [Semántica · 2026-10-23]: cada mensaje es un <article> del registro -->
          <article
            class="max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm"
            [class]="
              turn.role === 'user'
                ? 'bg-[var(--lvl-deep,var(--primary))] text-white'
                : 'border-l-4 border-[var(--lvl,var(--primary))] bg-muted'
            "
          >
            <span class="mb-0.5 block text-[11px] font-bold opacity-80">{{
              turn.role === 'user' ? youLabel() : tutorLabel()
            }}</span>
            {{ turn.content }}
            @if (streaming() && $last && turn.role === 'assistant') {
              <span
                class="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-current motion-safe:animate-pulse"
                aria-hidden="true"
              ></span>
            }
          </article>
        </div>
      } @empty {
        <p class="py-10 text-center text-sm text-muted-foreground">{{ emptyLabel() }}</p>
      }
    </div>
  `,
})
export class ConversationChatComponent {
  readonly turns = input.required<ChatTurn[]>();
  readonly streaming = input(false);
  readonly label = input('Conversación');
  readonly youLabel = input('Tú');
  readonly tutorLabel = input('Tutor');
  readonly emptyLabel = input('');

  // `viewChild` (Angular signals): referencia al contenedor desplazable
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  constructor() {
    // `effect`: cada token nuevo baja el scroll al final (lee `turns()` para suscribirse a sus cambios)
    effect(() => {
      this.turns();
      const el = this.scroller().nativeElement;
      queueMicrotask(() => (el.scrollTop = el.scrollHeight)); // Tras pintar el DOM
    });
  }
}
