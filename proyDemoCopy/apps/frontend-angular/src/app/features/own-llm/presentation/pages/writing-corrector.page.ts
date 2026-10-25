import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { I18nService } from '@core/i18n/i18n.service';
import { BadgeComponent } from '@shared/ui/atoms/badge/badge.component';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { TextInputComponent } from '@shared/ui/atoms/text-input/text-input.component';
import { FormFieldComponent } from '@shared/ui/molecules/form-field/form-field.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { TwoColumnTemplate } from '@shared/ui/templates/two-column.template';
import { OwnLlmFacade } from '../../application/own-llm.facade';
import {
  countWords,
  LEVELS,
  MAX_TEXT,
  WRITING_LANGUAGES,
  type WritingLanguage,
} from '../../domain/models/own-llm';
import { MarkedTextComponent } from '../components/marked-text.component';
// [WritingCorrectorPage · Presentación]: editor de redacción (Signal Forms) + resultado del LLM propio: texto marcado, versión corregida, hallazgos y explicación | [Patrón]: Container (inyecta la fachada, sin HTTP) + Máquina de estados en plantilla | [Principio]: SRP + DIP | [Paradigma]: Declarativo + Reactivo
// [A11y]: resultado en región `aria-live` · errores del formulario asociados al campo · avisos de IA y de respaldo siempre visibles (nunca se presenta la IA como verificada)

@Component({
  selector: 'aula-writing-corrector-page',
  imports: [
    FormField,
    CardPageTemplate,
    TwoColumnTemplate,
    FormFieldComponent,
    TextInputComponent,
    ButtonComponent,
    BadgeComponent,
    SpinnerComponent,
    MarkedTextComponent,
    IconComponent,
    LevelTintDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().ownLlm;
    <aula-card-page [heading]="t.title" [subtitle]="t.subtitle">
      <!-- [Color por nivel · Sprint 7.8]: toda la ficha toma el color MCER elegido (franja, hallazgo activo); el nivel también va en texto -->
      <div [aulaLevel]="model().level">
        <div
          class="mb-4 flex items-center gap-3 rounded-xl bg-linear-135 from-(--lvl-deep) to-(--lvl) px-4 py-3 text-white"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-extrabold"
            >{{ model().level }}</span
          >
          <span class="min-w-0">
            <span class="flex items-center gap-1.5 text-sm font-bold"
              ><aula-icon name="pen-line" [size]="16" /> {{ t.title }}</span
            >
            <span class="block truncate text-xs opacity-85"
              >{{ languageName(model().language) }} · {{ t.level }} {{ model().level }}</span
            >
          </span>
        </div>
        <form class="space-y-4" (submit)="onSubmit($event)" novalidate>
          <aula-form-field #textField fieldId="writing-text" [label]="t.text" [error]="textError()">
            <span fieldAside class="text-xs text-muted-foreground" aria-live="polite">{{
              i18n.fmt(t.words, { n: words() })
            }}</span>
            <aula-text-input
              [formField]="f.text"
              inputId="writing-text"
              [multiline]="true"
              [rows]="8"
              [describedBy]="textField.describedBy()"
            />
          </aula-form-field>

          <div class="flex flex-wrap items-end gap-3">
            <aula-form-field fieldId="writing-level" [label]="t.level" class="w-40">
              <!-- <select> nativo enlazado con [formField]: Signal Forms sincroniza el valor sin adaptador -->
              <select id="writing-level" class="control w-full" [formField]="f.level">
                @for (l of levels; track l) {
                  <option [value]="l">{{ l }}</option>
                }
              </select>
            </aula-form-field>
            <aula-form-field fieldId="writing-language" [label]="t.language" class="w-48">
              <!-- [7 idiomas]: nombre en el idioma de la interfaz con Intl.DisplayNames (sin tabla propia) -->
              <select id="writing-language" class="control w-full" [formField]="f.language">
                @for (l of languages; track l) {
                  <option [value]="l">{{ languageName(l) }}</option>
                }
              </select>
            </aula-form-field>
            <button
              aulaButton
              type="submit"
              class="ml-auto"
              [loading]="facade.correction.loading()"
            >
              {{ facade.correction.loading() ? t.submitting : t.submit }}
            </button>
          </div>
        </form>

        <section
          class="mt-6 space-y-4"
          aria-live="polite"
          [attr.aria-busy]="facade.correction.loading()"
        >
          @switch (facade.correction.status()) {
            @case ('loading') {
              <aula-spinner [label]="t.submitting" />
            }
            @case ('error') {
              <p
                role="alert"
                class="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-3 text-sm text-tone-danger"
              >
                {{ facade.correction.error() }}
              </p>
            }
            @case ('success') {
              @if (facade.correction.data(); as r) {
                <p
                  class="rounded-lg border border-tone-warning-line bg-tone-warning-soft p-3 text-xs text-tone-warning"
                >
                  {{ i18n.t().common.aiReview }}
                  @if (r.fallback_used) {
                    <br />{{ t.fallback }}
                  }
                </p>
                <aula-two-column>
                  <div left>
                    <h2 class="text-sm font-bold">{{ t.original }}</h2>
                    <aula-marked-text
                      [segments]="facade.segments()"
                      [findings]="r.findings"
                      [typeLabels]="t.types"
                      [selected]="selected()"
                      (pick)="selected.set($event)"
                    />
                  </div>
                  <div right>
                    <h2 class="text-sm font-bold">{{ t.corrected }}</h2>
                    <p
                      class="whitespace-pre-wrap rounded-xl border border-border bg-background p-4 leading-8"
                    >
                      {{ r.corrected_text }}
                    </p>
                  </div>
                </aula-two-column>

                <div>
                  <h2 class="mb-2 text-sm font-bold">{{ t.findings }} ({{ r.findings.length }})</h2>
                  @if (r.findings.length) {
                    <ol class="space-y-2">
                      @for (fi of r.findings; track $index) {
                        <li
                          class="rounded-lg border p-3 text-sm"
                          [class.border-(--lvl)]="selected() === $index"
                          [class.border-border]="selected() !== $index"
                        >
                          <aula-badge tone="danger" icon="alert">{{ t.types[fi.type] }}</aula-badge>
                          <span class="ml-2 line-through decoration-tone-danger">{{
                            fi.original
                          }}</span>
                          → <b>{{ fi.correction }}</b>
                          <p class="mt-1 text-muted-foreground">{{ fi.explanation_es }}</p>
                        </li>
                      }
                    </ol>
                  } @else {
                    <p class="text-sm text-muted-foreground">{{ t.noFindings }}</p>
                  }
                </div>

                <div>
                  <h2 class="mb-1 text-sm font-bold">{{ t.explanation }}</h2>
                  <p class="text-sm">{{ r.explanation_es }}</p>
                  <p class="mt-2 text-xs text-muted-foreground">
                    {{ i18n.fmt(t.model, { model: r.model_used, ms: r.latency_ms }) }}
                  </p>
                </div>
              }
            }
          }
        </section>
      </div>
    </aula-card-page>
  `,
})
export default class WritingCorrectorPage {
  protected readonly i18n = inject(I18nService);
  protected readonly facade = inject(OwnLlmFacade);
  protected readonly levels = LEVELS;
  protected readonly languages = WRITING_LANGUAGES;
  protected readonly selected = signal<number | null>(null); // Hallazgo resaltado (texto ↔ lista)

  // [Signal Forms]: el modelo es un signal; `form()` crea el árbol de campos con sus reglas | mensajes reactivos al idioma
  protected readonly model = signal({
    text: '',
    language: 'en' as WritingLanguage,
    level: 'A2' as (typeof LEVELS)[number],
  });
  protected readonly f = form(this.model, (p) => {
    required(p.text, { message: () => this.i18n.t().ownLlm.minLength });
    minLength(p.text, 3, { message: () => this.i18n.t().ownLlm.minLength });
    maxLength(p.text, MAX_TEXT, {
      message: () => this.i18n.fmt(this.i18n.t().ownLlm.maxLength, { n: MAX_TEXT }),
    });
  });

  protected readonly words = computed(() => countWords(this.model().text));
  // [textError]: primer mensaje del campo, solo tras tocarlo (no se grita al usuario antes de escribir)
  protected readonly textError = computed(() => {
    const state = this.f.text();
    return state.touched() && state.invalid() ? (state.errors()[0]?.message ?? '') : '';
  });

  // [languageName]: «inglés», «francés»… en el idioma de la interfaz | `Intl.DisplayNames` (ECMA-402)
  protected languageName(code: WritingLanguage): string {
    return new Intl.DisplayNames([this.i18n.locale()], { type: 'language' }).of(code) ?? code;
  }

  // [onSubmit]: `submit()` (Signal Forms) marca todo como tocado y solo ejecuta la acción si el formulario es válido
  protected onSubmit(e: Event): void {
    e.preventDefault();
    void submit(this.f, async () => {
      this.selected.set(null);
      await this.facade.correct({
        text: this.model().text.trim(),
        language: this.model().language,
        level: this.model().level,
      });
    });
  }
}
