// [Historias · FilterPanelComponent · 2026-11-17]: panel común de filtros (Buscar · Nivel · filtros propios · Filtrar · Limpiar + idiomas debajo)
// [Patrón]: CSF 3 + Atomic Design (molécula) + Two-way binding (`model()`) + Content Projection | [Principio]: DRY (un panel para Práctica, Juegos, Canciones, Diálogos y Lectura) | [Paradigma]: Declarativo + Reactivo
import type { Meta, StoryObj } from '@storybook/angular'; // `import type` (TS): solo tipos → se borran al compilar
import { fn } from 'storybook/test'; // `fn` (Storybook): espía → el panel Actions muestra «Filtrar» y «Limpiar»
import { FilterPanelComponent } from './filter-panel.component';

// `satisfies Meta<T>` (TS): valida el objeto sin ensanchar su tipo
const meta = {
  title: 'UI/Molecules/FilterPanel',
  parameters: { docs: { description: { component: 'Panel común de filtros con búsqueda, nivel, idiomas y filtros propios proyectados.\n\n**Patrón:** CSF 3 + Atomic Design (molécula) + Two-way binding + Content Projection · **Principio:** DRY · **Paradigma:** Declarativo + Reactivo' } } },
  component: FilterPanelComponent,
  // [render]: plantilla con `[(search)]`/`[(language)]` (two-way binding de `model()`) y un filtro propio proyectado con <ng-content>
  render: (args) => ({
    props: { ...args, apply: fn(), cleared: fn(), search: '', language: '' },
    template: `
      <aula-filter-panel [(search)]="search" [(language)]="language" [showLevel]="showLevel" [searchPlaceholder]="searchPlaceholder" (apply)="apply()" (cleared)="cleared()">
        <label class="filter-field">Género
          <select class="control"><option>Todos</option><option>Cuento</option><option>Fábula</option></select>
        </label>
      </aula-filter-panel>`,
  }),
  args: { showLevel: true, searchPlaceholder: 'Título o autor' },
} satisfies Meta<FilterPanelComponent>;

export default meta; // `export default` (ESM): Storybook lee el meta de la exportación por defecto
type Story = StoryObj<FilterPanelComponent>;

export const Default: Story = {};
export const WithoutLevel: Story = { args: { showLevel: false } }; // Libros: no tienen nivel MCER
