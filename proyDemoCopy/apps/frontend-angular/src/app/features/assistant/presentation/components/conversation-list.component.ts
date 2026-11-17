import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { I18nService } from '@core/i18n/i18n.service';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import type { ConversationSummary } from '../../domain/models/assistant';
// [ConversationListComponent · Presentación · 2026-10-28]: «Mis conversaciones» del Tutor IA — abrir, renombrar en línea y pedir borrado (el diálogo lo pinta la página) | [Patrón]: Presentational Component (input()/output()) | [Principio]: SRP + DIP (sin fachada ni HTTP) | [Paradigma]: Declarativo + Reactivo (signals)
// [A11y]: <nav> con nombre · la conversación activa con aria-current="page" · renombrar = <input> con etiqueta, Enter guarda y Escape cancela (el foco vuelve al menú) · aria-busy mientras carga

@Component({
  selector: 'aula-conversation-list',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' },
  template: `
    @let t = i18n.t().assistant;
    <nav [attr.aria-label]="t.conversationsTitle" [attr.aria-busy]="loading()">
      <h2 class="title-overline mb-2 text-muted-foreground">{{ t.conversationsTitle }}</h2>
      @if (!conversations().length && !loading()) {
        <p class="text-muted-foreground">{{ t.conversationsEmpty }}</p>
      }
      <ul class="space-y-1">
        @for (c of conversations(); track c.id) {
          <li class="group flex items-center gap-1 rounded-lg" [class]="c.id === activeId() ? 'bg-tone-brand-soft text-tone-brand' : 'hover:bg-muted'">
            @if (editingId() === c.id) {
              <!-- [Renombrar en línea]: <form> → Enter guarda; Escape cancela | maxlength = TUTOR_TITLE_MAX de NestJS -->
              <form class="flex min-w-0 flex-1 items-center gap-1 p-1" (submit)="$event.preventDefault(); saveRename(c)">
                <label class="sr-only" [for]="'rename-' + c.id">{{ t.renameLabel }}</label>
                <input
                  #renameInput
                  class="control h-8 min-h-8 min-w-0 flex-1 py-1 text-sm"
                  [id]="'rename-' + c.id"
                  maxlength="120"
                  autocomplete="off"
                  [value]="draft()"
                  (input)="draft.set($any($event.target).value)"
                  (keydown.escape)="$event.preventDefault(); cancelRename()"
                />
                <button type="submit" class="grid size-8 place-items-center rounded-lg hover:bg-background disabled:opacity-40" [disabled]="!draft().trim() || busy()" [attr.aria-label]="t.save" [title]="t.save">
                  <aula-icon name="check" [size]="16" />
                </button>
                <button type="button" class="grid size-8 place-items-center rounded-lg hover:bg-background" [attr.aria-label]="t.cancel" [title]="t.cancel" (click)="cancelRename()">
                  <aula-icon name="x" [size]="16" />
                </button>
              </form>
            } @else {
              <button
                type="button"
                class="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                [attr.aria-current]="c.id === activeId() ? 'page' : null"
                [disabled]="busy()"
                (click)="opened.emit(c.id)"
              >
                <span class="block truncate text-sm font-semibold">{{ c.title }}</span>
                <span class="block truncate text-[11px] text-muted-foreground">{{ i18n.languageName(c.language) }} · {{ c.level }} · {{ date(c.updatedAt) }}</span>
              </button>
              <!-- [Fix 2026-10-30]: Renombrar y Eliminar a la vista (antes dentro de un menú ⋮ que además generaba scroll en la lista) -->
              <button type="button" class="grid size-8 shrink-0 place-items-center rounded-lg opacity-70 hover:bg-background hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [disabled]="busy()" [attr.aria-label]="t.rename + ': ' + c.title" [title]="t.rename" (click)="startRename(c)">
                <aula-icon name="pencil" [size]="15" />
              </button>
              <button type="button" class="grid size-8 shrink-0 place-items-center rounded-lg text-tone-danger opacity-70 hover:bg-background hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [disabled]="busy()" [attr.aria-label]="t.delete + ': ' + c.title" [title]="t.delete" (click)="removeRequested.emit(c)">
                <aula-icon name="trash-2" [size]="15" />
              </button>
            }
          </li>
        }
      </ul>
    </nav>
  `,
})
export class ConversationListComponent {
  protected readonly i18n = inject(I18nService);
  readonly conversations = input.required<ConversationSummary[]>();
  readonly activeId = input<string | undefined>(undefined);
  readonly loading = input(false);
  readonly busy = input(false);
  readonly opened = output<string>();
  readonly renamed = output<{ id: string; title: string }>();
  readonly removeRequested = output<ConversationSummary>(); // La página confirma con su diálogo (sin window.confirm)

  protected readonly editingId = signal<string | null>(null);
  protected readonly draft = signal('');
  private readonly renameInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');

  protected startRename(c: ConversationSummary): void {
    this.editingId.set(c.id);
    this.draft.set(c.title);
    queueMicrotask(() => this.renameInput()?.nativeElement.select()); // Tras pintar el <input>: texto seleccionado para reescribir
  }

  protected saveRename(c: ConversationSummary): void {
    const title = this.draft().trim();
    if (title && title !== c.title) this.renamed.emit({ id: c.id, title });
    this.cancelRename();
  }

  protected cancelRename(): void {
    this.editingId.set(null);
  }

  // [date]: fecha corta en el idioma de la interfaz | `Intl.DateTimeFormat` (ECMA-402)
  protected date(iso: string): string {
    return new Intl.DateTimeFormat(this.i18n.intl(), { day: 'numeric', month: 'short' }).format(new Date(iso));
  }
}
