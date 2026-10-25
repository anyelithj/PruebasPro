import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { Dict } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { canEdit, canRemove, type Post, type Viewer } from '../../domain/models/forums';
import { ForumPostFormComponent } from './forum-post-form.component';
// [PostListComponent · Presentacional]: respuestas del hilo con edición en línea (autor) y retirada (autor o moderador) | [Patrón]: Presentational Component + Policy (permisos puros del dominio) | [Principio]: SRP + DRY (mismo formulario para editar) | [Paradigma]: Declarativo
// [A11y]: <ol> (orden cronológico con significado), autor y fecha en texto, acciones con nombre accesible

@Component({
  selector: 'aula-post-list',
  imports: [ButtonComponent, ForumPostFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = t();
    <ol class="space-y-3">
      @for (p of posts(); track p.id) {
        <li class="rounded-xl border border-border p-3 text-sm">
          <p class="mb-1 text-xs text-muted-foreground">
            <span class="font-semibold text-foreground">{{ p.authorName }}</span> ·
            <time [attr.datetime]="p.createdAt">{{ date()(p.createdAt) }}</time>
            @if (p.editedAt) {
              · {{ tx.edited }}
            }
          </p>
          @if (editing() === p.id) {
            <aula-forum-post-form [fieldId]="'edit-' + p.id" [label]="tx.editPost" [compact]="true" [initial]="p.body" [submitLabel]="tx.save" [cancelLabel]="tx.cancel" [busy]="busy()" (submitted)="edit.emit({ id: p.id, body: $event }); editing.set(null)" (cancelled)="editing.set(null)" />
          } @else {
            <p class="whitespace-pre-line">{{ p.body }}</p>
            <div class="mt-2 flex gap-2">
              @if (canEdit(viewer(), p)) {
                <button aulaButton variant="ghost" size="sm" type="button" [attr.aria-label]="tx.edit + ' · ' + p.authorName" (click)="editing.set(p.id)">{{ tx.edit }}</button>
              }
              @if (canRemove(viewer(), p)) {
                <button aulaButton variant="ghost" size="sm" type="button" class="text-tone-danger" [attr.aria-label]="tx.remove + ' · ' + p.authorName" (click)="remove.emit(p)">{{ tx.remove }}</button>
              }
            </div>
          }
        </li>
      } @empty {
        <li class="py-6 text-center text-sm text-muted-foreground">{{ tx.noPosts }}</li>
      }
    </ol>
  `,
})
export class PostListComponent {
  readonly posts = input.required<Post[]>();
  readonly viewer = input.required<Viewer>();
  readonly t = input.required<Dict['forums']>();
  readonly busy = input(false);
  readonly date = input.required<(iso: string) => string>();
  readonly edit = output<{ id: string; body: string }>();
  readonly remove = output<Post>();
  protected readonly editing = signal<string | null>(null);
  protected readonly canEdit = canEdit;
  protected readonly canRemove = canRemove;
}
