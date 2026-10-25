import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';
import { FormField, form, submit, validateStandardSchema } from '@angular/forms/signals';
import type { Dict } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { TextInputComponent } from '@shared/ui/atoms/text-input/text-input.component';
import { FormFieldComponent } from '@shared/ui/molecules/form-field/form-field.component';
import { FaqInputSchema, HELP_LOCALES, HELP_ROLES, type Faq, type FaqInput, type HelpLocale } from '../../domain/models/help';
// [FaqFormComponent · Presentacional]: editor de FAQ para ADMIN (crear y editar) | [Patrón]: Presentational Component + Modal nativo | [Principio]: SRP + Fail Fast + SSOT (las reglas son el esquema Zod del dominio, iguales a las del DTO de NestJS) | [Paradigma]: Declarativo + Reactivo
// [Tecnología]: Angular 22 Signal Forms + `validateStandardSchema` (Zod 4 implementa Standard Schema) · [A11y]: <dialog> con `showModal()` (foco atrapado, Escape cierra) y errores asociados a cada campo

type FieldKey = keyof FaqInput;
const empty = (locale: HelpLocale): FaqInput => ({ question: '', answer: '', category: '', role: 'ALL', locale, manualSlug: '' });

@Component({
  selector: 'aula-faq-form',
  imports: [FormField, FormFieldComponent, TextInputComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = t();
    <dialog #dlg class="w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-slate-900/50" aria-labelledby="faq-form-title" (close)="closed.emit()">
      <form class="space-y-4 p-5" (submit)="onSubmit($event)" novalidate>
        <h2 id="faq-form-title" class="text-lg font-bold">{{ faq() ? tx.formTitleEdit : tx.formTitleNew }}</h2>
        <aula-form-field #q fieldId="faq-question" [label]="tx.question" [error]="err('question')">
          <aula-text-input inputId="faq-question" [formField]="f.question" [describedBy]="q.describedBy()" />
        </aula-form-field>
        <aula-form-field #a fieldId="faq-answer" [label]="tx.answer" [error]="err('answer')">
          <aula-text-input inputId="faq-answer" [formField]="f.answer" [multiline]="true" [rows]="5" [describedBy]="a.describedBy()" />
        </aula-form-field>
        <div class="grid gap-3 sm:grid-cols-3">
          <aula-form-field #c fieldId="faq-category" [label]="tx.category" [hint]="tx.categoryHint" [error]="err('category')" class="sm:col-span-3">
            <aula-text-input inputId="faq-category" [formField]="f.category" [describedBy]="c.describedBy()" />
          </aula-form-field>
          <aula-form-field fieldId="faq-role" [label]="tx.role">
            <select id="faq-role" class="control w-full" [formField]="f.role">
              @for (r of roles; track r) {
                <option [value]="r">{{ tx.roles[r] }}</option>
              }
            </select>
          </aula-form-field>
          <aula-form-field fieldId="faq-locale" [label]="tx.language">
            <select id="faq-locale" class="control w-full" [formField]="f.locale">
              @for (l of locales; track l) {
                <option [value]="l">{{ l.toUpperCase() }}</option>
              }
            </select>
          </aula-form-field>
          <aula-form-field #m fieldId="faq-manual" [label]="tx.manualSlug" [hint]="tx.manualSlugHint" [error]="err('manualSlug')">
            <aula-text-input inputId="faq-manual" [formField]="f.manualSlug" [describedBy]="m.describedBy()" />
          </aula-form-field>
        </div>
        <div class="flex justify-end gap-2">
          <button aulaButton variant="ghost" size="sm" type="button" (click)="dlg.close()">{{ tx.cancel }}</button>
          <button aulaButton size="sm" type="submit" [loading]="busy()">{{ tx.save }}</button>
        </div>
      </form>
    </dialog>
  `,
})
export class FaqFormComponent {
  readonly open = input(false);
  readonly faq = input<Faq | null>(null); // null = nueva
  readonly locale = input<HelpLocale>('es');
  readonly busy = input(false);
  readonly t = input.required<Dict['help']>();
  readonly saved = output<FaqInput>();
  readonly closed = output<void>();
  protected readonly roles = HELP_ROLES;
  protected readonly locales = HELP_LOCALES;
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  // [Signal Forms]: modelo como signal + el esquema Zod del dominio como única fuente de reglas
  protected readonly model = signal<FaqInput>(empty('es'));
  protected readonly f = form(this.model, (p) => validateStandardSchema(p, FaqInputSchema));

  constructor() {
    // `effect`: abrir el diálogo carga la FAQ (o un formulario vacío en el idioma activo) y lo muestra modal
    effect(() => {
      const dialog = this.dlg().nativeElement;
      if (!this.open()) return dialog.open ? dialog.close() : undefined;
      const x = this.faq();
      this.model.set(x ? { question: x.question, answer: x.answer, category: x.category, role: x.role, locale: x.locale, manualSlug: x.manualSlug ?? '' } : empty(this.locale()));
      this.f().reset();
      if (!dialog.open) dialog.showModal();
    });
  }

  // [err]: mensaje traducido del campo, solo tras tocarlo (Zod da el «qué»; el texto lo pone el diccionario)
  protected err(key: FieldKey): string {
    const state = this.f[key]();
    return state.touched() && state.invalid() ? this.t().invalid : '';
  }

  protected onSubmit(e: Event): void {
    e.preventDefault();
    void submit(this.f, async () => this.saved.emit(FaqInputSchema.parse(this.model())));
  }
}
