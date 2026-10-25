import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormField, form, submit, validateStandardSchema } from '@angular/forms/signals';
import type { Dict } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { TextInputComponent } from '@shared/ui/atoms/text-input/text-input.component';
import { FormFieldComponent } from '@shared/ui/molecules/form-field/form-field.component';
import { ThreadInputSchema, type ThreadInput } from '../../domain/models/forums';
// [ForumThreadFormComponent · Presentacional]: abrir un hilo (título + mensaje) | [Patrón]: Presentational Component (input()/output()) | [Principio]: SRP + SSOT (reglas = esquema Zod del dominio, iguales al DTO de NestJS) | [Paradigma]: Declarativo + Reactivo
// [Tecnología]: Angular 22 Signal Forms + `validateStandardSchema` · [A11y]: etiquetas, error por campo tras tocarlo

@Component({
  selector: 'aula-forum-thread-form',
  imports: [FormField, FormFieldComponent, TextInputComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = t();
    <form class="space-y-3 rounded-xl border border-border p-4" (submit)="onSubmit($event)" novalidate>
      <h2 class="text-base font-bold">{{ tx.newThread }}</h2>
      <aula-form-field #ti fieldId="thread-title" [label]="tx.threadTitle" [error]="err('title')">
        <aula-text-input inputId="thread-title" [formField]="f.title" [describedBy]="ti.describedBy()" />
      </aula-form-field>
      <aula-form-field #bo fieldId="thread-body" [label]="tx.message" [error]="err('body')">
        <aula-text-input inputId="thread-body" [formField]="f.body" [multiline]="true" [rows]="4" [describedBy]="bo.describedBy()" />
      </aula-form-field>
      <button aulaButton size="sm" type="submit" [loading]="busy()">{{ tx.publish }}</button>
    </form>
  `,
})
export class ForumThreadFormComponent {
  readonly t = input.required<Dict['forums']>();
  readonly busy = input(false);
  readonly submitted = output<ThreadInput>();

  protected readonly model = signal<ThreadInput>({ title: '', body: '' });
  protected readonly f = form(this.model, (p) => validateStandardSchema(p, ThreadInputSchema));

  protected err(key: keyof ThreadInput): string {
    const s = this.f[key]();
    return s.touched() && s.invalid() ? (key === 'title' ? this.t().titleError : this.t().bodyError) : '';
  }

  protected onSubmit(e: Event): void {
    e.preventDefault();
    void submit(this.f, async () => {
      this.submitted.emit(ThreadInputSchema.parse(this.model()));
      this.model.set({ title: '', body: '' });
      this.f().reset();
    });
  }
}
