import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';
import { SECTION_META, SECTION_TYPES, type Section, type SectionInput, type SectionType } from '../../domain/models/grammar';
// [GrammarSectionFormComponent · Presentacional · Sprint 10.12 · RF-133/RF-135]: crear o editar una sección (tipo, título opcional y texto o fórmula) | [Patrón]: Presentational Component | [Principio]: SRP + DRY (mismo formulario para alta y edición) | [Paradigma]: Declarativo + Reactivo (signals)

@Component({
  selector: 'aula-grammar-section-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let tx = labels();
    <form class="grid gap-2 sm:grid-cols-[12rem_1fr]" (submit)="$event.preventDefault(); submit()">
      <label class="text-xs font-semibold">
        {{ tx.sectionType }}
        <select class="control mt-1 w-full" [value]="type()" (change)="type.set($any($event.target).value)">
          @for (t of types; track t) {
            <option [value]="t">{{ typeLabels()[t] }}</option>
          }
        </select>
      </label>
      <label class="text-xs font-semibold">
        {{ tx.sectionTitle }}
        <input class="control mt-1 w-full" maxlength="120" [value]="title()" (input)="title.set($any($event.target).value)" />
      </label>
      <label class="text-xs font-semibold sm:col-span-2">
        {{ tx.sectionBody }}
        <textarea class="control mt-1 min-h-20 w-full" maxlength="4000" [value]="body()" (input)="body.set($any($event.target).value)"></textarea>
      </label>
      <div class="flex gap-2 sm:col-span-2">
        <button type="submit" class="btn btn-primary btn-sm" [disabled]="busy()">{{ section() ? tx.save : '＋ ' + tx.addSection }}</button>
      </div>
    </form>
  `,
})
export class GrammarSectionFormComponent {
  protected readonly types = SECTION_TYPES;
  protected readonly meta = SECTION_META;
  readonly section = input<Section | null>(null); // null = alta
  readonly busy = input(false);
  readonly typeLabels = input.required<Record<SectionType, string>>();
  readonly labels = input.required<{ sectionType: string; sectionTitle: string; sectionBody: string; save: string; addSection: string }>();
  readonly saved = output<SectionInput>();

  protected readonly type = signal<SectionType>('usage');
  protected readonly title = signal('');
  protected readonly body = signal('');

  constructor() {
    // [Edición]: al recibir una sección se precargan sus valores
    effect(() => {
      const s = this.section();
      untracked(() => {
        this.type.set(s?.type ?? 'usage');
        this.title.set(s?.title ?? '');
        this.body.set(s?.body ?? '');
      });
    });
  }

  protected submit(): void {
    this.saved.emit({ type: this.type(), title: this.title().trim(), body: this.body().trim() });
    if (!this.section()) {
      this.title.set('');
      this.body.set('');
    }
  }
}
