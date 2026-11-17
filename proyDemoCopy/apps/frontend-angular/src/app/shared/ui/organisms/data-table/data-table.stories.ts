// [Historias · DataTableComponent]: tabla genérica <T> con caption, columnas tipadas, celda personalizada y estado vacío | [Patrón]: CSF 3 + Atomic Design (organismo) + Template Method (ng-template #cell) + Generics | [Principio]: OCP + DRY | [Paradigma]: Declarativo + Genérico
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { BadgeComponent } from '../../atoms/badge/badge.component';
import { DataTableComponent, type DataColumn } from './data-table.component';

// `interface` (TS): forma de la fila de ejemplo → `keyof Student` valida las claves de columna
interface Student {
  name: string;
  level: string;
  score: number;
}

const COLUMNS: DataColumn<Student>[] = [
  { key: 'name', header: 'Estudiante' },
  { key: 'level', header: 'Nivel' },
  { key: 'score', header: 'Puntaje', align: 'end' },
];
const ROWS: readonly Student[] = [
  { name: 'Ana Pérez', level: 'B1', score: 92 },
  { name: 'Luis Gómez', level: 'A2', score: 78 },
  { name: 'Marta Ruiz', level: 'C1', score: 98 },
];

// `DataTableComponent<Student>` (TS genérico): fija T para que args y columnas se validen
const meta = {
  title: 'UI/Organisms/DataTable',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Tabla genérica <T> con caption, columnas tipadas, celda personalizada y estado vacío.\n\n**Patrón:** CSF 3 + Atomic Design (organismo) + Template Method (ng-template #cell) + Generics · **Principio:** OCP + DRY · **Paradigma:** Declarativo + Genérico' } } },
  component: DataTableComponent<Student>,
  decorators: [moduleMetadata({ imports: [BadgeComponent] })],
  args: { caption: 'Resultados del curso', columns: COLUMNS, rows: ROWS, empty: 'Sin resultados' },
} satisfies Meta<DataTableComponent<Student>>;

export default meta;
type Story = StoryObj<DataTableComponent<Student>>;

export const Default: Story = {};
export const Empty: Story = { args: { rows: [] } }; // `@empty` del @for → fila con el texto `empty`

// [CustomCell]: <ng-template #cell> recibe la fila ($implicit) y la columna → Badge para el nivel
export const CustomCell: Story = {
  render: (args) => ({
    props: args,
    template: `
      <aula-data-table [caption]="caption" [columns]="columns" [rows]="rows">
        <ng-template #cell let-row let-column="column">
          @if (column === 'level') { <aula-badge tone="brand">{{ row.level }}</aula-badge> } @else { {{ row[column] }} }
        </ng-template>
      </aula-data-table>`,
  }),
};
