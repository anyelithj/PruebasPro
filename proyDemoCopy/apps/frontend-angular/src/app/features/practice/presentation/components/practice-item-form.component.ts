import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { I18nService } from '@core/i18n/i18n.service';
import { ButtonComponent } from '@shared/ui/atoms/button/button.component';
import {
  ITEM_TYPES,
  ItemInputSchema,
  SKILLS,
  itemProblem,
  type FullItem,
  type ItemInput,
  type ItemType,
} from '../../domain/models/practice';
// [PracticeItemFormComponent · Presentacional · Sprint 8.15]: editor ÚNICO de ítem (alta y edición) — tipo, habilidad, enunciado, opciones, respuestas aceptadas, correcciones, explicación y consejo | [Patrón]: Presentational Component + Adapter (texto por líneas ⇄ arrays del contrato) | [Principio]: DRY (crear y editar) + SSOT (reglas: itemProblem = espejo de la Specification de NestJS) | [Paradigma]: Declarativo + Funcional (conversiones puras)
// [Tecnología]: Angular 22 Signal Forms (`form` + [formField]) sobre un modelo de texto plano · [A11y]: cada campo con etiqueta y pista según el tipo; el problema de validación se muestra en role="alert"

interface ItemText {
  itemType: ItemType;
  skill: (typeof SKILLS)[number];
  prompt: string;
  options: string; // Una por línea
  accepted: string; // Formato según el tipo (ver pistas)
  corrections: string; // «3=went» por línea (mark_errors)
  explanation: string;
  tip: string;
}

const lines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
const cells = (s: string) =>
  s
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);

// [toInput]: texto del formulario → contrato ItemInput | [Paradigma]: función pura
export function toInput(t: ItemText): ItemInput {
  const accepted =
    t.itemType === 'mark_errors'
      ? [
          t.accepted
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        ]
      : t.itemType === 'fill_blank' || t.itemType === 'drag_order'
        ? lines(t.accepted).map(cells)
        : t.itemType === 'match_pairs'
          ? lines(t.accepted).map((l) => [l])
          : [lines(t.accepted)]; // multiple_choice / open_answer: variantes de una sola respuesta
  const corrections = Object.fromEntries(
    lines(t.corrections)
      .map((l) => l.split('=').map((x) => x.trim()))
      .filter((p) => p.length === 2 && p[0]),
  );
  return {
    itemType: t.itemType,
    skill: t.skill,
    prompt: t.prompt.trim(),
    options: lines(t.options),
    accepted,
    corrections,
    explanation: t.explanation.trim(),
    tip: t.tip.trim(),
  };
}

// [toText]: ítem guardado → texto editable (inversa de toInput)
export function toText(i: FullItem): ItemText {
  const accepted =
    i.itemType === 'mark_errors'
      ? (i.accepted[0] ?? []).join(', ')
      : i.itemType === 'fill_blank' || i.itemType === 'drag_order'
        ? i.accepted.map((a) => a.join(' | ')).join('\n')
        : i.itemType === 'match_pairs'
          ? i.accepted.map((a) => a[0] ?? '').join('\n')
          : (i.accepted[0] ?? []).join('\n');
  return {
    itemType: i.itemType,
    skill: i.skill,
    prompt: i.prompt,
    options: i.options.join('\n'),
    accepted,
    corrections: Object.entries(i.corrections)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n'),
    explanation: i.explanation,
    tip: i.tip,
  };
}

const BLANK: ItemText = {
  itemType: 'multiple_choice',
  skill: 'grammar',
  prompt: '',
  options: '',
  accepted: '',
  corrections: '',
  explanation: '',
  tip: '',
};

@Component({
  selector: 'aula-practice-item-form',
  imports: [FormField, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    @let tx = i18n.t().practice;
    @let type = model().itemType;
    <form class="space-y-3" (submit)="save($event)" novalidate>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="text-sm font-semibold">
          {{ tx.itemType }}
          <select class="control mt-1 w-full" [formField]="f.itemType">
            @for (t of types; track t) {
              <option [value]="t">{{ tx.types[t] }}</option>
            }
          </select>
        </label>
        <label class="text-sm font-semibold">
          {{ tx.skill }}
          <select class="control mt-1 w-full" [formField]="f.skill">
            @for (s of skills; track s) {
              <option [value]="s">{{ tx.skills[s] }}</option>
            }
          </select>
        </label>
      </div>
      <label class="block text-sm font-semibold">
        {{ tx.prompt }}
        <textarea
          class="control mt-1 w-full"
          rows="3"
          [formField]="f.prompt"
          [attr.aria-describedby]="'hint-prompt-' + uid()"
        ></textarea>
        <span
          class="mt-0.5 block text-xs font-normal text-muted-foreground"
          [id]="'hint-prompt-' + uid()"
          >{{ tx.promptHints[type] }}</span
        >
      </label>
      @if (type === 'multiple_choice' || type === 'match_pairs' || type === 'drag_order') {
        <label class="block text-sm font-semibold">
          {{ tx.options }}
          <textarea class="control mt-1 w-full" rows="3" [formField]="f.options"></textarea>
        </label>
      }
      <label class="block text-sm font-semibold">
        {{ tx.accepted }}
        <textarea
          class="control mt-1 w-full"
          rows="2"
          [formField]="f.accepted"
          [attr.aria-describedby]="'hint-acc-' + uid()"
        ></textarea>
        <span
          class="mt-0.5 block text-xs font-normal text-muted-foreground"
          [id]="'hint-acc-' + uid()"
          >{{ tx.acceptedHints[type] }}</span
        >
      </label>
      @if (type === 'mark_errors') {
        <label class="block text-sm font-semibold">
          {{ tx.correctionsField }}
          <textarea class="control mt-1 w-full" rows="2" [formField]="f.corrections"></textarea>
        </label>
      }
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-sm font-semibold">
          {{ tx.explanation }}
          <textarea class="control mt-1 w-full" rows="2" [formField]="f.explanation"></textarea>
        </label>
        <label class="block text-sm font-semibold">
          {{ tx.tipField }}
          <textarea class="control mt-1 w-full" rows="2" [formField]="f.tip"></textarea>
        </label>
      </div>
      @if (problem(); as p) {
        <p role="alert" class="text-sm text-tone-danger">{{ p }}</p>
      }
      <div class="flex flex-wrap gap-2">
        <button aulaButton size="sm" type="submit" [loading]="busy()">{{ submitLabel() }}</button>
        @if (cancellable()) {
          <button aulaButton size="sm" variant="ghost" type="button" (click)="cancelled.emit()">
            {{ tx.cancel }}
          </button>
        }
      </div>
    </form>
  `,
})
export class PracticeItemFormComponent {
  protected readonly i18n = inject(I18nService);
  readonly item = input<FullItem | null>(null); // null = alta
  readonly busy = input(false);
  readonly submitLabel = input('Guardar');
  readonly cancellable = input(true); // El alta fija al pie no se cancela
  readonly uid = input('new'); // Sufijo de ids (varios formularios en la página)
  readonly saved = output<ItemInput>();
  readonly cancelled = output<void>();
  protected readonly types = ITEM_TYPES;
  protected readonly skills = SKILLS;
  protected readonly model = signal<ItemText>({ ...BLANK });
  protected readonly f = form(this.model); // Signal Forms: enlaza cada control nativo con su campo del modelo
  protected readonly problem = signal<string | null>(null);
  protected readonly value = computed(() => toInput(this.model())); // Contrato derivado del texto (se recalcula al escribir)

  constructor() {
    effect(() => {
      const it = this.item();
      untracked(() => this.model.set(it ? toText(it) : { ...BLANK }));
    });
  }

  // [save]: valida con la misma regla que NestJS (itemProblem) + forma (Zod) y emite el contrato
  protected save(e: Event): void {
    e.preventDefault();
    const value = this.value();
    const shape = ItemInputSchema.safeParse(value);
    const problem =
      itemProblem(value) ??
      (shape.success ? null : this.i18n.t().practice.acceptedHints[value.itemType]);
    this.problem.set(problem);
    if (!problem && shape.success) this.saved.emit(shape.data);
  }
}
