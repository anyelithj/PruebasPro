import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
} from '@angular/core';
import type { ChatTurn } from '../../application/game-agent.facade';
// [ChatTurnsComponent · Presentacional · Sprint 8.9]: turnos del usuario y del agente | [Patrón]: Presentational Component | [Principio]: SRP | [Paradigma]: Declarativo
// [A11y]: <ol> con `aria-live="polite"` → el lector anuncia cada respuesta nueva; quién habla en texto («Tú» / «Agente»), marcas del motor con icono + texto · desplazamiento automático al último turno

@Component({
  selector: 'aula-chat-turns',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <ol
      class="flex max-h-[50vh] min-h-40 flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-3"
      aria-live="polite"
      aria-relevant="additions"
    >
      @for (t of turns(); track $index) {
        <li class="flex" [class.justify-end]="t.who === 'user'">
          <div
            class="max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm"
            [class]="
              t.who === 'user'
                ? 'rounded-br-sm bg-[var(--btn-solid)] text-white'
                : 'rounded-bl-sm border border-border bg-card'
            "
          >
            <p class="text-[11px] font-bold uppercase tracking-wide opacity-80">
              {{ t.who === 'user' ? youLabel() : agentLabel() }}
            </p>
            <p class="whitespace-pre-line" [attr.lang]="language()">{{ t.text }}</p>
            @if (t.flag === 'violation') {
              <p class="mt-1 text-xs font-semibold text-tone-danger"><aula-icon name="triangle-alert" /> {{ violationLabel() }}</p>
            } @else if (t.flag === 'solved') {
              <p class="mt-1 text-xs font-semibold text-tone-brand"><aula-icon name="trophy" /> {{ solvedLabel() }}</p>
            }
            @if (t.who === 'agent' && note(t); as n) {
              <p class="mt-1 text-xs text-muted-foreground"><aula-icon name="lightbulb" /> {{ n }}</p>
            }
          </div>
        </li>
      }
      @if (thinking()) {
        <li class="flex">
          <p
            class="rounded-2xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground motion-safe:animate-pulse"
          >
            {{ thinkingLabel() }}
          </p>
        </li>
      }
    </ol>
  `,
})
export class ChatTurnsComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly turns = input.required<ChatTurn[]>();
  readonly thinking = input(false);
  readonly language = input('en');
  readonly youLabel = input('Tú');
  readonly agentLabel = input('Agente');
  readonly violationLabel = input('Palabra prohibida');
  readonly solvedLabel = input('¡Adivinado!');
  readonly thinkingLabel = input('…');
  readonly noteFor = input<(t: ChatTurn) => string>(() => ''); // La página traduce las pistas del motor

  constructor() {
    // `effect`: nuevo turno → desplaza la lista al final (sin mover el foco del usuario)
    effect(() => {
      this.turns();
      this.thinking();
      queueMicrotask(() => {
        const list = (this.host.nativeElement as HTMLElement).querySelector('ol');
        if (list) list.scrollTop = list.scrollHeight; // `scrollTop` (DOM): disponible en todos los navegadores y en jsdom
      });
    });
  }

  protected note(t: ChatTurn): string {
    return this.noteFor()(t);
  }
}
