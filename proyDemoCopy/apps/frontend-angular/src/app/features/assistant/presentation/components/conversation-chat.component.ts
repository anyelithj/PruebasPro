import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import type { ChatTurn } from '../../domain/models/assistant';

import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
// [ConversationChatComponent · Presentación]: lista de turnos con la respuesta en streaming + [2026-10-28] menú por mensaje (editar los propios / eliminar cualquiera) y edición en línea | [Patrón]: Presentational Component (inputs/outputs; la página decide y confirma) | [Principio]: SRP | [Paradigma]: Declarativo + Reactivo (effect para el autoscroll)
// [Color por nivel · Sprint 7.8]: lee `--lvl`/`--lvl-deep` del ancestro con [aulaLevel] (sin él → color primario)
// [A11y]: role="log" + aria-live="polite" → el lector anuncia lo nuevo · cada turno dice quién habla en texto (no solo por alineación/color) · edición con <textarea> etiquetado, aviso asociado (aria-describedby), Escape cancela y Ctrl/⌘+Enter guarda

// [emphasize · 2026-11-11]: «"The dog is big."» y «**palabra**» → trozos destacados (sin innerHTML: Angular escapa el texto) | Función pura
// split con grupo de captura: posiciones impares = lo destacado
const EMPHASIS = /(\*\*[^*\n]+\*\*|"[^"\n]+"|“[^”\n]+”)/;
export function emphasize(text: string): { text: string; strong: boolean }[] {
  return text
    .split(EMPHASIS)
    .map((part, i) => ({ text: i % 2 && part.startsWith('**') ? part.slice(2, -2) : part, strong: i % 2 === 1 }))
    .filter((x) => x.text);
}

@Component({
  selector: 'aula-conversation-chat',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-col' }, // [2026-11-09]: el desplazamiento queda DENTRO del registro (antes el panel entero se desplazaba y el texto pasaba bajo el campo)
  template: `
    @let t = i18n.t().assistant;
    <div
      #scroller
      role="log"
      aria-live="polite"
      [attr.aria-busy]="streaming() || busy()"
      class="space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-border bg-background p-3 sm:p-4"
      [class]="fill() ? 'min-h-0 flex-1' : 'h-[min(60dvh,32rem)]'"
      tabindex="0"
      [attr.aria-label]="label()"
    >
      <!-- [Saludo del tutor · 2026-10-28]: primera burbuja propia del TUTOR (el asistente «Soporte y Guía» tiene la suya) | no se guarda ni se envía -->
      @if (greeting()) {
        <div class="flex">
          <article class="max-w-[85%] rounded-2xl border-l-4 border-[var(--lvl,var(--primary))] bg-muted px-4 py-2 text-sm">
            <span class="mb-0.5 block text-[11px] font-bold opacity-80">{{ tutorLabel() }}</span>
            {{ greeting() }}
          </article>
        </div>
      }
      @for (turn of turns(); track turn.id ?? $index) {
        <div class="group flex items-start gap-1" [class.flex-row-reverse]="turn.role === 'user'">
          <!-- [Semántica · 2026-10-23]: cada mensaje es un <article> del registro -->
          <article
            class="min-w-0 whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm"
            [class]="
              (editingId() === turn.id ? 'w-full ' : 'max-w-[85%] ') +
              (turn.role === 'user'
                ? 'bg-[var(--lvl-deep,var(--primary))] text-white'
                : 'border-l-4 border-[var(--lvl,var(--primary))] bg-muted')
            "
          >
            <span class="mb-0.5 block text-[11px] font-bold opacity-80"
              >{{ turn.role === 'user' ? youLabel() : tutorLabel() }}
              @if (turn.editedAt) {
                <span class="font-normal">{{ t.edited }}</span>
              }</span
            >
            @if (editingId() && editingId() === turn.id) {
              <!-- [Editar en línea]: el servidor trunca lo posterior y el tutor responde de nuevo (lo avisa el texto de ayuda) -->
              <form class="space-y-2 whitespace-normal" (submit)="$event.preventDefault(); save(turn)">
                <label class="sr-only" [for]="'edit-' + turn.id">{{ t.editLabel }}</label>
                <textarea
                  #editor
                  class="control box-border w-full max-w-full resize-y text-foreground"
                  rows="3"
                  maxlength="2000"
                  [id]="'edit-' + turn.id"
                  [attr.aria-describedby]="'edit-hint-' + turn.id"
                  [value]="draft()"
                  (input)="draft.set($any($event.target).value)"
                  (keydown.escape)="$event.preventDefault(); cancel()"
                  (keydown.control.enter)="save(turn)"
                  (keydown.meta.enter)="save(turn)"
                ></textarea>
                <p class="type-meta opacity-90" [id]="'edit-hint-' + turn.id">{{ t.editHint }}</p>
                <div class="flex justify-end gap-2">
                  <button type="button" class="rounded-lg px-3 py-1 text-xs font-semibold hover:bg-white/15" (click)="cancel()">{{ t.cancel }}</button>
                  <button type="submit" class="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-[var(--lvl-deep,var(--primary))] disabled:opacity-50" [disabled]="!draft().trim() || busy()">{{ t.save }}</button>
                </div>
              </form>
            } @else if (turn.role === 'assistant') {
              <!-- [2026-11-11 · «resalta las palabras importantes»]: ejemplos entre comillas y **negritas** del asistente → negrita de color (el español y el idioma objetivo no se confunden) -->
              @for (seg of emphasize(turn.content); track $index) {
                @if (seg.strong) {
                  <strong class="font-bold text-tone-brand">{{ seg.text }}</strong>
                } @else {
                  {{ seg.text }}
                }
              }
            } @else {
              {{ turn.content }}
            }
            @if (streaming() && $last && turn.role === 'assistant') {
              <span
                class="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-current motion-safe:animate-pulse"
                aria-hidden="true"
              ></span>
            }
          </article>
          <!-- [Acciones del mensaje · 2026-10-30]: botones directos (el menú ⋮ abría dentro de la caja con scroll y generaba otra barra) | solo mensajes guardados · visibles al pasar el ratón o con el foco (y siempre en táctil)
               Los mensajes del tutor no se editan: sería falsear su respuesta -->
          @if (turn.id && !streaming() && editingId() !== turn.id) {
            <span class="flex shrink-0 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              @if (turn.role === 'user') {
                <button type="button" class="grid size-7 place-items-center rounded-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [disabled]="busy()" [attr.aria-label]="t.edit" [title]="t.edit" (click)="startEdit(turn)"><aula-icon name="pencil" [size]="14" /></button>
              }
              <button type="button" class="grid size-7 place-items-center rounded-lg text-tone-danger hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [disabled]="busy()" [attr.aria-label]="t.delete" [title]="t.delete" (click)="removeRequested.emit(turn.id!)"><aula-icon name="trash-2" [size]="14" /></button>
            </span>
          }
        </div>
      } @empty {
        @if (!greeting()) {
          <p class="py-10 text-center text-muted-foreground">{{ emptyLabel() }}</p>
        }
      }
    </div>
  `,
})
export class ConversationChatComponent {
  protected readonly emphasize = emphasize;
  protected readonly i18n = inject(I18nService);
  readonly turns = input.required<ChatTurn[]>();
  readonly streaming = input(false);
  readonly busy = input(false); // [2026-10-28]: editar/borrar en curso → menús deshabilitados
  readonly label = input('Conversación');
  readonly youLabel = input('Tú');
  readonly tutorLabel = input('Tutor');
  readonly emptyLabel = input('');
  readonly greeting = input('');
  readonly fill = input(false); // [2026-11-09]: true = ocupa el alto disponible del contenedor (chatbot flotante) // [2026-10-28]: saludo inicial del tutor ('' = sin saludo)
  readonly edited = output<{ id: string; content: string }>();
  readonly removeRequested = output<string>(); // id del mensaje → la página confirma con su diálogo

  protected readonly editingId = signal<string | null>(null);
  protected readonly draft = signal('');
  // `viewChild` (Angular signals): referencia al contenedor desplazable y al editor en línea
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly editor = viewChild<ElementRef<HTMLTextAreaElement>>('editor');

  constructor() {
    // `effect`: cada token nuevo baja el scroll al final (lee `turns()` para suscribirse a sus cambios)
    effect(() => {
      this.turns();
      const el = this.scroller().nativeElement;
      queueMicrotask(() => (el.scrollTop = el.scrollHeight)); // Tras pintar el DOM
    });
  }

  protected startEdit(turn: ChatTurn): void {
    if (!turn.id) return;
    this.editingId.set(turn.id);
    this.draft.set(turn.content);
    queueMicrotask(() => this.editor()?.nativeElement.focus()); // Tras pintar el <textarea>
  }

  protected save(turn: ChatTurn): void {
    const content = this.draft().trim();
    if (!turn.id || !content || this.busy()) return;
    if (content !== turn.content) this.edited.emit({ id: turn.id, content });
    this.cancel();
  }

  protected cancel(): void {
    this.editingId.set(null);
  }
}
