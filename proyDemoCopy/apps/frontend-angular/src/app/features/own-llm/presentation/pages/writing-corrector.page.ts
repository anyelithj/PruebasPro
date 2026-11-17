import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormField, form, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { LevelTintDirective } from '@shared/ui/atoms/level-tint/level-tint.directive';
import { SpinnerComponent } from '@shared/ui/atoms/spinner/spinner.component';
import { TextInputComponent } from '@shared/ui/atoms/text-input/text-input.component';
import { FormFieldComponent } from '@shared/ui/molecules/form-field/form-field.component';
import { PronunciationButtonComponent } from '@shared/ui/molecules/pronunciation-button/pronunciation-button.component';
import { CardPageTemplate } from '@shared/ui/templates/card-page.template';
import { OwnLlmFacade } from '../../application/own-llm.facade';
import { AUTO, countByType, countWords, ERROR_TYPES, LEVELS, MAX_TEXT, WRITING_LANGUAGES, type WritingLanguageOrAuto } from '../../domain/models/own-llm';
import { ERROR_TONE, MarkedTextComponent } from '../components/marked-text.component';
import { markWords } from '@features/dialogues/domain/models/dialogues'; // [2026-11-06]: mismo marcado palabra a palabra que Diálogos
// [WritingCorrectorPage · Presentación]: corrector al estilo GrammarMama — editor SIEMPRE editable (Signal Forms) → «Corregir» → a su lado «Explicaciones» (original → corregido · categoría · por qué, en español) y debajo:
// «Original (errores resaltados)» · «Texto corregido» (🔊 escuchar + Copiar + usar en el editor)
// [Patrón]: Container (inyecta la fachada, sin HTTP) + Snapshot (el resultado es una foto del texto enviado; el editor sigue libre) | [Principio]: SRP + DIP + DRY | [Paradigma]: Declarativo + Reactivo (signals)
// [Fix 2026-10-28]: (1) el editor ya no se sustituye por el texto marcado → se puede borrar/escribir en cualquier momento sin pulsar «Editar»
// (2) «Detectado: Inglés» va junto al selector de idioma y la corrección usa ese idioma (FastAPI lo detecta; antes los empates caían al idioma por defecto)
// (3) categorías como GrammarMama (Ortografía, Mayúsculas, Gramática…) y explicación por error SIEMPRE en español
// [A11y]: resultado en región `aria-live` · marcas = botones con nombre «Tipo: «x» → «y»» que llevan a su explicación · resaltado + subrayado distinto por tipo (no solo color) · Ctrl+Enter corrige
// [Responsive]: original y corregido apilados en móvil, lado a lado desde lg

const SPEAK_MAX = 300; // [DRY con /traductor]: mismo tope de caracteres que se envían a la voz (audio del servidor)

@Component({
  selector: 'aula-writing-corrector-page',
  imports: [
    FormField,
    CardPageTemplate,
    FormFieldComponent,
    TextInputComponent,
    ButtonComponent,
    SpinnerComponent,
    MarkedTextComponent,
    IconComponent,
    LevelTintDirective,
    PronunciationButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.t().ownLlm;
    @let rv = facade.review();
    <aula-card-page [heading]="t.title" [subtitle]="t.subtitle">
      <!-- [Color por nivel · Sprint 7.8]: la ficha toma el color MCER elegido; el nivel también va en texto -->
      <div [aulaLevel]="model().level" class="space-y-4">
        <!-- [Rejilla · 2026-10-31]: editor a la izquierda + explicaciones a la derecha desde lg; sin errores el editor ocupa todo el ancho -->
        <div [class]="showExplanations() ? 'grid gap-4 lg:grid-cols-2 lg:items-start' : 'grid gap-4'">
        <form
          class="surface flex min-w-0 flex-col overflow-hidden"
          (submit)="onSubmit($event)"
          (keydown.control.enter)="onSubmit($event)"
          (keydown.meta.enter)="onSubmit($event)"
          novalidate
        >
          <!-- [Barra superior]: idioma (Detectar por defecto) + «Detectado: X» al lado · nivel -->
          <div class="flex flex-wrap items-end gap-3 border-b border-border bg-linear-135 from-(--lvl-deep)/10 to-(--lvl)/5 p-3">
            <aula-form-field fieldId="writing-language" [label]="t.language" class="w-full sm:w-auto">
              <!-- <select> nativo enlazado con [formField]: Signal Forms sincroniza el valor sin adaptador -->
              <select id="writing-language" class="control w-full sm:w-48" [formField]="f.language">
                <option [value]="auto">{{ t.detectLanguage }}</option>
                @for (l of languages; track l) {
                  <option [value]="l">{{ i18n.languageName(l) }}</option>
                }
              </select>
            </aula-form-field>
            <aula-form-field fieldId="writing-level" [label]="t.level" class="w-32">
              <select id="writing-level" class="control w-full" [formField]="f.level">
                @for (l of levels; track l) {
                  <option [value]="l">{{ l }}</option>
                }
              </select>
            </aula-form-field>
            <!-- [2026-10-30]: «Detectado: X» DESPUÉS de Idioma y Nivel (antes en medio) | mb-2: alineado con los selectores (flex items-end) -->
            @if (detected(); as d) {
              <span role="status" class="mb-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-tone-brand-soft px-2.5 py-1 text-xs font-semibold text-tone-brand">
                <aula-icon name="sparkles" [size]="12" /> {{ i18n.fmt(t.detected, { lang: i18n.languageName(d) }) }}
              </span>
            }
          </div>

          <!-- [Fix 2026-10-28 · Editor siempre editable]: el textarea nunca se oculta ni se bloquea tras corregir (como GrammarMama) -->
          <aula-form-field #textField fieldId="writing-text" [label]="t.text" [error]="textError()" class="block p-3">
            <!-- [Borrar · 2026-10-30]: la ✕ va DENTRO del área de texto, arriba a la derecha (como Google Translate) | absolute (CSS) sobre el contenedor relative -->
            <div class="relative">
              <aula-text-input
                [formField]="f.text"
                inputId="writing-text"
                [multiline]="true"
                [rows]="8"
                [placeholder]="t.placeholder"
                [describedBy]="textField.describedBy()"
              />
              @if (model().text) {
                <button type="button" class="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" [attr.aria-label]="t.clear" [title]="t.clear" (click)="clear()"><aula-icon name="x" [size]="20" /></button>
              }
            </div>
          </aula-form-field>

          <!-- [Barra inferior]: contadores + borrar + corregir -->
          <div class="flex flex-wrap items-center gap-2 border-t border-border p-3">
            <span class="text-xs text-muted-foreground" aria-live="polite">
              {{ i18n.fmt(t.chars, { n: model().text.length, max }) }} · {{ i18n.fmt(t.words, { n: words() }) }}
            </span>
            <span class="ml-auto flex flex-wrap items-center gap-2">
              <button aulaButton type="submit" [loading]="facade.correction.loading()">
                {{ facade.correction.loading() ? t.submitting : t.submit }}
              </button>
            </span>
          </div>
        </form>

          <!-- [Explicaciones · Fix 2026-10-31]: a la DERECHA de Idioma · Nivel · Tu redacción (antes al final, lejos del texto) | apiladas en móvil
               «original → corregido · Categoría · explicación en español» (una por error, en el orden del texto) | overflow-y-auto + tabindex: la lista larga se desplaza también con teclado (WCAG 2.1.1) -->
          @if (showExplanations()) {
            <aside class="surface min-w-0 p-3 lg:max-h-[30rem] lg:overflow-y-auto" tabindex="0" aria-live="polite" [attr.aria-label]="t.explanations">
              <h2 class="title-section mb-2">{{ t.explanations }}</h2>
              <ol class="space-y-2">
                @for (fi of findings(); track fi.start) {
                  <li
                    [id]="'writing-finding-' + $index"
                    tabindex="-1"
                    class="rounded-xl border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-ring"
                    [class]="selected() === $index ? 'border-(--lvl) shadow-sm' : 'border-border'"
                  >
                    <p class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span [attr.lang]="correctedIn()"><s class="text-muted-foreground">{{ fi.original }}</s> → <b>{{ fi.correction || '∅' }}</b></span>
                      <span aria-hidden="true">·</span>
                      <span class="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        <span class="size-2 shrink-0 rounded-full" [class]="tone[fi.type].dot" aria-hidden="true"></span>
                        {{ t.types[fi.type] }}
                      </span>
                    </p>
                    <!-- \`lang="es"\` (HTML): la explicación SIEMPRE está en español → el lector de pantalla la pronuncia bien aunque el texto sea inglés -->
                    <p class="mt-1 text-muted-foreground" lang="es">{{ fi.explanation_es }}</p>
                  </li>
                }
              </ol>
            </aside>
          }
        </div>

        <!-- [Resultado]: región viva — original resaltado · texto corregido · explicaciones -->
        <section class="space-y-4" aria-live="polite" [attr.aria-busy]="facade.correction.loading()" [attr.aria-label]="t.findings">
          @switch (facade.correction.status()) {
            @case ('loading') {
              <aula-spinner [label]="t.submitting" />
            }
            @case ('error') {
              <p role="alert" class="rounded-lg border border-tone-danger-line bg-tone-danger-soft p-3 text-tone-danger">
                {{ facade.correction.error() }}
              </p>
            }
            @case ('success') {
              @if (facade.correction.data(); as r) {
                <!-- [2026-11-06 · Puntuación]: % grande + mensaje + palabra a palabra (mismo diseño que la corrección de Diálogos; rojo tachado / verde subrayado, no solo color) -->
                <div class="space-y-2 rounded-xl border border-border bg-card p-3">
                  <p class="flex flex-wrap items-center gap-3">
                    <span class="text-3xl font-extrabold tabular-nums" [class.text-tone-brand]="score() >= 70" [class.text-tone-danger]="score() < 70">{{ score() }} %</span>
                    <span class="font-semibold">{{ i18n.fmt(score() >= 90 ? t.scoreGreat : score() >= 70 ? t.scoreGood : t.scoreWeak, { pct: score() }) }}</span>
                  </p>
                  @if (rv && findings().length) {
                    <p class="type-meta font-semibold text-muted-foreground">{{ t.yoursMarked }}</p>
                    <p class="leading-relaxed" [attr.lang]="correctedIn()">
                      @for (w of markWords(rv.text, r.corrected_text); track $index) {
                        <span [class]="w.ok === false ? 'rounded bg-tone-danger-soft px-0.5 text-tone-danger line-through' : ''">{{ w.text }}</span>
                      }
                    </p>
                    <p class="type-meta font-semibold text-muted-foreground">{{ t.fixedMarked }}</p>
                    <p class="text-lg leading-relaxed" [attr.lang]="correctedIn()">
                      @for (w of markWords(r.corrected_text, rv.text); track $index) {
                        <span [class]="w.ok === false ? 'rounded bg-tone-brand-soft px-0.5 font-semibold text-tone-brand underline' : ''">{{ w.text }}</span>
                      }
                    </p>
                  }
                </div>
                <!-- [Cabecera]: nº de errores + idioma usado + leyenda de colores con cifras -->
                <div class="flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                    [class]="findings().length ? 'bg-tone-danger-soft text-tone-danger' : 'bg-tone-brand-soft text-tone-brand'"
                  >
                    <aula-icon [name]="findings().length ? 'triangle-alert' : 'check'" [size]="14" />
                    {{ findings().length === 1 ? t.errorsOne : findings().length ? i18n.fmt(t.errorsCount, { n: findings().length }) : t.noFindings }}
                  </span>
                  @if (correctedIn(); as lang) {
                    <span class="type-meta text-muted-foreground">{{ i18n.fmt(t.correctedIn, { lang: i18n.languageName(lang) }) }}</span>
                  }
                  @if (findings().length) {
                    <span class="flex flex-wrap gap-1.5 sm:ml-auto" role="list" [attr.aria-label]="t.legend">
                      @for (type of presentTypes(); track type.key) {
                        <span role="listitem" class="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold">
                          <span class="size-2 rounded-full" [class]="tone[type.key].dot" aria-hidden="true"></span>
                          {{ t.types[type.key] }} · {{ type.n }}
                        </span>
                      }
                    </span>
                  }
                </div>

                <div class="grid gap-4 lg:grid-cols-2">
                  <!-- [Original (errores resaltados)]: foto del texto ENVIADO (los índices del servidor se refieren a él) -->
                  @if (rv) {
                    <article class="surface min-w-0 p-3">
                      <h2 class="title-section mb-1">{{ t.original }}</h2>
                      <aula-marked-text
                        [segments]="facade.segments()"
                        [findings]="rv.findings"
                        [typeLabels]="t.types"
                        [selected]="selected()"
                        [lang]="correctedIn()"
                        (pick)="pick($event)"
                      />
                      @if (findings().length) {
                        <p class="type-meta text-muted-foreground">{{ t.pickHint }}</p>
                      }
                    </article>
                  }

                  <!-- [Texto corregido]: 🔊 (ServerAudioService vía aula-pronunciation-button) + Copiar + Usar en el editor -->
                  <article class="surface flex min-w-0 flex-col bg-gradient-soft p-3">
                    <div class="mb-1 flex flex-wrap items-center gap-2">
                      <h2 class="title-section">{{ t.corrected }}</h2>
                      <span class="ml-auto flex items-center gap-1">
                        <aula-pronunciation-button [text]="r.corrected_text.slice(0, speakMax)" [language]="correctedIn() ?? 'en'" [label]="t.listen" />
                        <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="t.copyLabel" [title]="t.copyLabel" (click)="copy()">
                          <aula-icon name="copy" /> {{ t.copy }}
                        </button>
                      </span>
                    </div>
                    <p class="flex-1 whitespace-pre-wrap break-words p-3 leading-8" [attr.lang]="correctedIn()">{{ r.corrected_text }}</p>
                    @if (r.corrected_text !== model().text) {
                      <button type="button" class="btn btn-outline btn-sm self-start" [attr.aria-label]="t.useCorrectedLabel" (click)="useCorrected()">
                        <aula-icon name="pen-line" /> {{ t.useCorrected }}
                      </button>
                    }
                    @if (status()) {
                      <p role="status" class="mt-2 type-meta font-semibold text-tone-brand">{{ status() }}</p>
                    }
                  </article>
                </div>

                <p class="type-meta text-muted-foreground">{{ i18n.fmt(t.model, { model: r.model_used, ms: r.latency_ms }) }}</p>
              }
            }
            @default {
              <p class="rounded-xl border border-dashed border-border p-4 text-muted-foreground">{{ t.emptyHint }}</p>
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
  protected readonly auto = AUTO;
  protected readonly max = MAX_TEXT;
  protected readonly speakMax = SPEAK_MAX;
  protected readonly tone = ERROR_TONE;
  protected readonly selected = signal<number | null>(null); // Error activo (marca ↔ explicación)
  protected readonly status = signal(''); // «Texto copiado» y similares

  // [Signal Forms]: el modelo es un signal; `form()` crea el árbol de campos con sus reglas | mensajes reactivos al idioma
  protected readonly model = signal({
    text: '',
    language: AUTO as WritingLanguageOrAuto, // [2026-10-27]: «Detectar idioma» por defecto
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
  protected readonly markWords = markWords;
  // [score · 2026-11-06]: % de palabras sin error en el texto enviado | ponytail: 1 error = 1 palabra; ponderar por longitud del tramo si se queda corto
  protected readonly score = computed(() => {
    const n = countWords(this.facade.review()?.text ?? '');
    return n ? Math.max(0, Math.round(100 * (1 - this.findings().length / n))) : 100;
  });
  // [findings]: errores con posición válida y sin solapes (los mismos que se resaltan) → la lista y las marcas siempre cuadran
  protected readonly findings = computed(() => this.facade.review()?.findings ?? []);
  protected readonly showExplanations = computed(() => this.facade.correction.status() === 'success' && this.findings().length > 0); // `computed` (signals): la columna derecha existe solo con errores que explicar
  // [detected · Fix 2026-10-28]: solo mientras el selector siga en «Detectar idioma» → si el alumno elige otro a mano, la insignia no queda desfasada
  // [Fix 2026-11-02]: también mientras se escribe (antes solo tras «Corregir»)
  private readonly typedLanguage = signal<string | null>(null);
  protected readonly detected = computed(() => (this.model().language === AUTO ? (this.typedLanguage() ?? this.facade.correction.data()?.detected_language ?? null) : null));
  // [Debounce 400 ms]: detecta al dejar de escribir | `onCleanup` (effect): cancela el temporizador anterior
  private readonly detectWhileTyping = effect((onCleanup) => {
    const { text, language } = this.model();
    if (language !== AUTO || text.trim().length < 3) return this.typedLanguage.set(null);
    const timer = setTimeout(async () => this.typedLanguage.set(await this.facade.detect(text.slice(0, 500))), 400);
    onCleanup(() => clearTimeout(timer));
  });
  // [2026-11-06 · Texto borrado a mano]: área vacía (seleccionar todo + borrar) → fuera puntuación, explicaciones y texto corregido, igual que la ✕
  private readonly clearOnEmpty = effect(() => {
    if (this.model().text.trim()) return;
    untracked(() => {
      if (this.facade.correction.status() === 'idle') return;
      this.facade.reset();
      this.selected.set(null);
      this.status.set('');
    });
  });
  protected readonly correctedIn = computed(() => this.facade.correction.data()?.language ?? null);
  // [presentTypes]: leyenda solo con los tipos presentes, en el orden canónico | `flatMap` (ES2019): filtra y mapea a la vez
  protected readonly presentTypes = computed(() => {
    const counts = countByType(this.findings());
    return ERROR_TYPES.flatMap((key) => (counts[key] ? [{ key, n: counts[key] }] : []));
  });
  // [textError]: primer mensaje del campo, solo tras tocarlo (no se grita al usuario antes de escribir)
  protected readonly textError = computed(() => {
    const state = this.f.text();
    return state.touched() && state.invalid() ? (state.errors()[0]?.message ?? '') : '';
  });

  // [pick]: clic en una marca → resalta y lleva el foco a su explicación | `scrollIntoView?.()` (encadenamiento opcional): jsdom no lo implementa
  protected pick(i: number): void {
    this.selected.set(i);
    const item = document.getElementById(`writing-finding-${i}`);
    item?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    item?.focus({ preventScroll: true });
  }

  // [clear]: vacía el editor Y el resultado (sin pasar por «Editar»)
  protected clear(): void {
    this.model.update((m) => ({ ...m, text: '' }));
    this.facade.reset();
    this.selected.set(null);
    this.status.set('');
  }

  // [useCorrected]: el texto corregido pasa al editor (se puede seguir escribiendo o volver a corregir)
  protected useCorrected(): void {
    const corrected = this.facade.correction.data()?.corrected_text;
    if (!corrected) return;
    this.model.update((m) => ({ ...m, text: corrected }));
    this.status.set(this.i18n.t().ownLlm.applied);
  }

  // [copy]: texto corregido del modelo | Clipboard API (contexto seguro)
  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.facade.correction.data()?.corrected_text ?? '');
      this.status.set(this.i18n.t().ownLlm.copied);
    } catch {
      this.status.set(this.i18n.t().ownLlm.copyError);
    }
  }

  // [onSubmit]: `submit()` (Signal Forms) marca todo como tocado y solo ejecuta la acción si el formulario es válido
  protected onSubmit(e: Event): void {
    e.preventDefault();
    if (this.facade.correction.loading()) return;
    void submit(this.f, async () => {
      this.selected.set(null);
      this.status.set('');
      await this.facade.correct({
        text: this.model().text.trim(),
        language: this.model().language,
        level: this.model().level,
      });
    });
  }
}
