import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { PostBodySchema } from '../../domain/models/forums';
// [ForumPostFormComponent · Presentacional]: responder a un hilo o editar una respuesta (mismo formulario: `initial` precarga el texto) | [Patrón]: Presentational Component + Reutilización por configuración | [Principio]: SRP + DRY (crear y editar) + Fail Fast (botón deshabilitado si el texto no es válido) | [Paradigma]: Declarativo + Reactivo
// [A11y]: <label> visible u oculto (`sr-only`) según el contexto; el textarea crece con `rows`

@Component({
  selector: 'aula-forum-post-form',
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="space-y-2" (submit)="$event.preventDefault(); send()">
      <label [for]="fieldId()" class="text-sm font-semibold" [class.sr-only]="compact()">{{ label() }}</label>
      <textarea [id]="fieldId()" class="control w-full resize-y" rows="3" maxlength="5000" [value]="text()" (input)="text.set($any($event.target).value)"></textarea>
      <div class="flex gap-2">
        <button aulaButton size="sm" type="submit" [loading]="busy()" [disabled]="!valid()">{{ submitLabel() }}</button>
        @if (cancelLabel()) {
          <button aulaButton variant="ghost" size="sm" type="button" (click)="cancelled.emit()">{{ cancelLabel() }}</button>
        }
      </div>
    </form>
  `,
})
export class ForumPostFormComponent {
  readonly fieldId = input('post-body');
  readonly label = input.required<string>();
  readonly submitLabel = input.required<string>();
  readonly cancelLabel = input(''); // '' = sin botón cancelar (respuesta nueva)
  readonly initial = input('');
  readonly compact = input(false);
  readonly busy = input(false);
  readonly submitted = output<string>();
  readonly cancelled = output<void>();
  protected readonly text = signal('');
  protected valid = () => PostBodySchema.safeParse(this.text()).success;

  constructor() {
    effect(() => this.text.set(this.initial())); // Editar: precarga el texto actual
  }

  protected send(): void {
    if (!this.valid()) return;
    this.submitted.emit(this.text().trim());
    if (!this.initial()) this.text.set(''); // Respuesta nueva → se limpia; edición → la cierra el padre
  }
}
