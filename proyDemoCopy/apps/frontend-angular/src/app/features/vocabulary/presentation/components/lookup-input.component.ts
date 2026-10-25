import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormField, form, submit, validateStandardSchema } from '@angular/forms/signals';
import { I18nService, type Dict } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { TextInputComponent } from '@shared/ui/atoms/text-input/text-input.component';
import { FormFieldComponent } from '@shared/ui/molecules/form-field/form-field.component';
import {
  LookupInputSchema,
  VOCAB_LANGUAGES,
  type LookupInput,
} from '../../domain/models/vocabulary';
// [LookupInputComponent · Presentacional · Sprint 8.3]: escribir un término o una frase y elegir el idioma | [Patrón]: Presentational Component (input()/output()) | [Principio]: SRP + SSOT (reglas = esquema Zod, iguales al DTO de NestJS) | [Paradigma]: Declarativo + Reactivo
// [Tecnología]: Angular 22 Signal Forms + `validateStandardSchema` · [A11y]: etiquetas visibles, Enter envía, botón ocupado con spinner · [Responsive]: idioma y botón bajo el texto en móvil

@Component({
  selector: 'aula-lookup-input',
  imports: [FormField, FormFieldComponent, TextInputComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = t();
    <form
      class="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
      (submit)="onSubmit($event)"
      novalidate
    >
      <aula-form-field #te fieldId="lookup-text" [label]="tx.text">
        <aula-text-input
          inputId="lookup-text"
          type="search"
          [placeholder]="tx.textPlaceholder"
          [formField]="f.text"
          [describedBy]="te.describedBy()"
        />
      </aula-form-field>
      <aula-form-field fieldId="lookup-language" [label]="tx.language">
        <!-- <select> nativo enlazado con [formField]: Signal Forms sincroniza el valor sin adaptador -->
        <select id="lookup-language" class="control w-full" [formField]="f.language">
          @for (code of languages; track code) {
            <option [value]="code">{{ i18n.languageName(code) }}</option>
          }
        </select>
      </aula-form-field>
      <button
        aulaButton
        type="submit"
        class="sm:mb-0.5"
        [loading]="busy()"
        [disabled]="f().invalid()"
      >
        {{ tx.translate }}
      </button>
    </form>
  `,
})
export class LookupInputComponent {
  protected readonly i18n = inject(I18nService);
  readonly t = input.required<Dict['vocabulary']>();
  readonly busy = input(false);
  readonly submitted = output<LookupInput>();
  protected readonly languages = VOCAB_LANGUAGES;

  protected readonly model = signal<LookupInput>({ text: '', language: 'en' });
  protected readonly f = form(this.model, (p) => validateStandardSchema(p, LookupInputSchema));

  // [setText]: el historial o un enlace (?q=) rellenan el campo sin teclear
  setText(text: string, language?: LookupInput['language']): void {
    this.model.update((m) => ({ text, language: language ?? m.language }));
  }

  protected onSubmit(e: Event): void {
    e.preventDefault(); // Sin recarga de página
    void submit(this.f, async () => this.submitted.emit(LookupInputSchema.parse(this.model())));
  }
}
