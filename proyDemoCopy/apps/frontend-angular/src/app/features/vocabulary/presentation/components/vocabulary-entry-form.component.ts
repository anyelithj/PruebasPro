import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormField, form, submit, validateStandardSchema } from '@angular/forms/signals';
import { I18nService, type Dict } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { TextInputComponent } from '@shared/ui/atoms/text-input/text-input.component';
import { FormFieldComponent } from '@shared/ui/molecules/form-field/form-field.component';
import {
  EntryFormSchema,
  EntryPatchSchema,
  VOCAB_LANGUAGES,
  type EntryForm,
  type EntryInput,
  type EntryPatch,
  type VocabularyEntry,
} from '../../domain/models/vocabulary';
// [VocabularyEntryFormComponent · Presentacional · Sprint 8.3]: formulario ÚNICO del banco — sin `entry` = alta (término, idioma y ejemplo; la IA completa traducción e IPA) · con `entry` = corrección (traducción, IPA UK/US o única y ejemplo) | [Patrón]: Presentational Component + modo por input | [Principio]: DRY (un formulario para crear y editar) + SSOT (esquemas Zod) | [Paradigma]: Declarativo + Reactivo
// [Tecnología]: Angular 22 Signal Forms + `validateStandardSchema` · [A11y]: etiquetas, pista de «la corrección manual prevalece», campos IPA con `lang="xx-fonipa"`

@Component({
  selector: 'aula-vocabulary-entry-form',
  imports: [FormField, FormFieldComponent, TextInputComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = t();
    @if (entry(); as e) {
      <!-- ───── Corrección ───── -->
      <form class="space-y-3" (submit)="onPatch($event, e)" novalidate>
        <h2 class="text-base font-bold">{{ i18n.fmt(tx.detailTitle, { term: e.term }) }}</h2>
        <p class="text-xs text-muted-foreground">{{ tx.manualHint }}</p>
        <aula-form-field fieldId="entry-translation" [label]="tx.colTranslation">
          <aula-text-input inputId="entry-translation" [formField]="p.translation" />
        </aula-form-field>
        @if (e.language === 'en') {
          <div class="grid gap-3 sm:grid-cols-2">
            <aula-form-field fieldId="entry-ipa-uk" [label]="tx.ipaUk"
              ><aula-text-input inputId="entry-ipa-uk" [formField]="p.ipaUk"
            /></aula-form-field>
            <aula-form-field fieldId="entry-ipa-us" [label]="tx.ipaUs"
              ><aula-text-input inputId="entry-ipa-us" [formField]="p.ipaUs"
            /></aula-form-field>
          </div>
        } @else {
          <aula-form-field fieldId="entry-ipa" [label]="tx.colIpa"
            ><aula-text-input inputId="entry-ipa" [formField]="p.ipa"
          /></aula-form-field>
        }
        <aula-form-field fieldId="entry-example" [label]="tx.example">
          <aula-text-input
            inputId="entry-example"
            [formField]="p.example"
            [multiline]="true"
            [rows]="2"
          />
        </aula-form-field>
        <div class="flex flex-wrap gap-2">
          <button aulaButton size="sm" type="submit" [loading]="busy()">{{ tx.save }}</button>
          <button aulaButton size="sm" variant="ghost" type="button" (click)="cancelled.emit()">
            {{ tx.cancel }}
          </button>
        </div>
      </form>
    } @else {
      <!-- ───── Alta ───── -->
      <form
        class="grid gap-3 sm:grid-cols-[1fr_10rem] lg:grid-cols-[1fr_10rem_1fr_auto] lg:items-end"
        (submit)="onCreate($event)"
        novalidate
      >
        <h2 class="text-base font-bold sm:col-span-2 lg:col-span-4">{{ tx.addTitle }}</h2>
        <aula-form-field fieldId="entry-term" [label]="tx.term"
          ><aula-text-input inputId="entry-term" [formField]="c.term"
        /></aula-form-field>
        <aula-form-field fieldId="entry-language" [label]="tx.language">
          <select id="entry-language" class="control w-full" [formField]="c.language">
            @for (code of languages; track code) {
              <option [value]="code">{{ i18n.languageName(code) }}</option>
            }
          </select>
        </aula-form-field>
        <aula-form-field fieldId="entry-new-example" [label]="tx.example"
          ><aula-text-input inputId="entry-new-example" [formField]="c.example"
        /></aula-form-field>
        <button
          aulaButton
          type="submit"
          class="lg:mb-0.5"
          [loading]="busy()"
          [disabled]="c().invalid()"
        >
          {{ tx.add }}
        </button>
      </form>
    }
  `,
})
export class VocabularyEntryFormComponent {
  protected readonly i18n = inject(I18nService);
  readonly t = input.required<Dict['vocabulary']>();
  readonly entry = input<VocabularyEntry | null>(null); // null = alta · entrada = corrección
  readonly busy = input(false);
  readonly created = output<EntryInput>();
  readonly patched = output<{ id: string; patch: EntryPatch }>();
  readonly cancelled = output<void>();
  protected readonly languages = VOCAB_LANGUAGES;

  private readonly blank: EntryForm = { term: '', language: 'en', example: '' };
  protected readonly createModel = signal<EntryForm>({ ...this.blank });
  protected readonly c = form(this.createModel, (p) => validateStandardSchema(p, EntryFormSchema));
  protected readonly patchModel = signal<Required<EntryPatch>>({
    translation: '',
    ipaUk: '',
    ipaUs: '',
    ipa: '',
    example: '',
  });
  protected readonly p = form(this.patchModel, (p) => validateStandardSchema(p, EntryPatchSchema));

  constructor() {
    // `effect` (Angular): al abrir otra entrada, el formulario de corrección se carga con sus valores actuales
    effect(() => {
      const e = this.entry();
      if (e)
        this.patchModel.set({
          translation: e.translation,
          ipaUk: e.ipaUk ?? '',
          ipaUs: e.ipaUs ?? '',
          ipa: e.ipa ?? '',
          example: e.example ?? '',
        });
    });
  }

  protected onCreate(ev: Event): void {
    ev.preventDefault();
    void submit(this.c, async () => {
      const v = EntryFormSchema.parse(this.createModel());
      this.created.emit({ ...v, example: v.example || undefined }); // Ejemplo vacío → no se envía
      this.createModel.set({ ...this.blank, language: v.language }); // Conserva el idioma para la siguiente palabra
      this.c().reset();
    });
  }

  protected onPatch(ev: Event, e: VocabularyEntry): void {
    ev.preventDefault();
    void submit(this.p, async () => {
      const v = EntryPatchSchema.parse(this.patchModel());
      // [Solo idioma de la entrada]: inglés envía UK/US; los demás, la única variante
      const patch: EntryPatch =
        e.language === 'en'
          ? { translation: v.translation, ipaUk: v.ipaUk, ipaUs: v.ipaUs, example: v.example }
          : { translation: v.translation, ipa: v.ipa, example: v.example };
      this.patched.emit({ id: e.id, patch });
    });
  }
}
