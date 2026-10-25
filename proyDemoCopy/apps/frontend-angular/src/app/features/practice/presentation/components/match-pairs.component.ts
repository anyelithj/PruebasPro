import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CdkDrag, CdkDropList, CdkDropListGroup, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { leftItems } from '../../domain/models/practice';
// [MatchPairsComponent · Presentacional · Sprint 8.14]: emparejar arrastrando cada ficha de la derecha a su elemento de la izquierda (CDK DragDrop) + selector nativo como alternativa | [Patrón]: Presentational Component + Observer | [Principio]: SRP + accesibilidad (WCAG 2.5.7: arrastrar no es la única forma) | [Paradigma]: Declarativo + Reactivo
// [Contrato]: answer[i] = ficha elegida para la izquierda i (izquierdas = líneas del enunciado)

@Component({
  selector: 'aula-match-pairs',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' }, // Elemento anfitrión en bloque → respeta márgenes y space-y del contenedor
  template: `
    <div cdkDropListGroup class="space-y-4">
      <!-- Fichas libres (origen del arrastre) -->
      <ul
        cdkDropList
        class="flex min-h-12 flex-wrap gap-2 rounded-xl border border-dashed border-border p-2"
        [cdkDropListDisabled]="disabled()"
      >
        @for (o of options(); track o) {
          <li
            cdkDrag
            [cdkDragData]="o"
            [cdkDragDisabled]="disabled()"
            class="chip cursor-grab bg-card"
            [attr.lang]="language()"
          >
            {{ o }}
          </li>
        }
      </ul>
      <ol class="space-y-2">
        @for (left of lefts(); track $index; let i = $index) {
          <li class="grid items-center gap-2 sm:grid-cols-[1fr_14rem]">
            <span class="font-semibold" [attr.lang]="language()">{{ left }}</span>
            <!-- Destino: soltar una ficha aquí o elegirla en el selector -->
            <div cdkDropList (cdkDropListDropped)="drop(i, $event)" class="rounded-lg">
              <select
                class="control w-full"
                [attr.aria-label]="pairLabel().replace('{left}', left)"
                [value]="values()[i] ?? ''"
                [disabled]="disabled()"
                (change)="set(i, $any($event.target).value)"
              >
                <option value="">{{ chooseLabel() }}</option>
                @for (o of options(); track o) {
                  <option [value]="o">{{ o }}</option>
                }
              </select>
            </div>
          </li>
        }
      </ol>
    </div>
  `,
})
export class MatchPairsComponent {
  readonly prompt = input.required<string>();
  readonly options = input.required<string[]>();
  readonly language = input('en');
  readonly disabled = input(false);
  readonly pairLabel = input('Pareja para «{left}»');
  readonly chooseLabel = input('Elige…');
  readonly changed = output<string[]>();
  protected readonly lefts = computed(() => leftItems(this.prompt()));
  protected readonly values = signal<string[]>([]);

  constructor() {
    effect(() => {
      const n = this.lefts().length;
      untracked(() => this.values.set(Array.from({ length: n }, () => '')));
    });
  }

  protected drop(i: number, e: CdkDragDrop<unknown, unknown, string>): void {
    this.set(i, e.item.data);
  }

  protected set(i: number, v: string): void {
    this.values.update((vals) => vals.map((x, j) => (j === i ? v : x)));
    this.changed.emit(this.values());
  }
}
