import { ChangeDetectionStrategy, Component, contentChild, input, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
// [DataTableComponent · Organismo]: tabla accesible con desplazamiento horizontal en móvil y celdas personalizables por plantilla | [Patrón]: Atomic Design (organismo) + Template Method (la página aporta `#cell`) | [Principio]: OCP (columnas nuevas sin tocar el componente) + DRY | [Paradigma]: Declarativo
// [A11y]: <caption> (oculta o visible), <th scope="col">, región enfocable con nombre para desplazar con teclado (WCAG 2.1.1)

// `export interface` (TS): definición de columna; `key` indexa la fila
export interface DataColumn<T> {
  key: keyof T & string;
  header: string;
  align?: 'start' | 'end';
}

@Component({
  selector: 'aula-data-table',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-x-auto rounded-xl border border-border" tabindex="0" role="region" [attr.aria-label]="caption()">
      <table class="w-full min-w-[36rem] text-sm">
        <caption class="sr-only">{{ caption() }}</caption>
        <thead class="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            @for (c of columns(); track c.key) {
              <th scope="col" class="px-3 py-2 font-semibold" [class.text-right]="c.align === 'end'">{{ c.header }}</th>
            }
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          @for (row of rows(); track trackBy()(row)) {
            <tr class="hover:bg-muted/40">
              @for (c of columns(); track c.key) {
                <td class="px-3 py-2 align-middle" [class.text-right]="c.align === 'end'">
                  @if (cell(); as tpl) {
                    <ng-container [ngTemplateOutlet]="tpl" [ngTemplateOutletContext]="{ $implicit: row, column: c.key }" />
                  } @else {
                    {{ row[c.key] }}
                  }
                </td>
              }
            </tr>
          } @empty {
            <tr>
              <td class="px-3 py-6 text-center text-muted-foreground" [attr.colspan]="columns().length">{{ empty() }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DataTableComponent<T extends object> {
  readonly caption = input.required<string>();
  readonly columns = input.required<DataColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  readonly empty = input('—');
  readonly trackBy = input<(row: T) => unknown>((row) => row);
  // `contentChild` (Angular signals): plantilla `<ng-template #cell let-row let-column="column">` opcional
  readonly cell = contentChild<TemplateRef<{ $implicit: T; column: string }>>('cell');
}
