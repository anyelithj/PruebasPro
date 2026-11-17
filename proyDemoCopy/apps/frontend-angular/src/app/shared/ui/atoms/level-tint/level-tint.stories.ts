// [Historias · LevelTintDirective]: tinte por nivel MCER (A1–C2) vía variables CSS `--lvl` / `--lvl-deep` | [Patrón]: Component Story Format (CSF 3) + Attribute Directive | [Principio]: DRY (un solo mapa de colores en @aula/ui-tokens) | [Paradigma]: Declarativo
// [A11y]: el color es decorativo → cada tarjeta muestra el nivel también en texto (WCAG 1.4.1)
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular'; // `import type`/`type` (TS): solo tipos, se borran al compilar
import { LevelTintDirective } from './level-tint.directive';

// `type` (TS): alias de los args que expone la historia (la directiva no es un componente → args propios)
type Args = { level: string | null };

const meta = {
  title: 'UI/Atoms/LevelTint',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Tinte por nivel MCER (A1–C2) vía variables CSS `--lvl` / `--lvl-deep`.\n\n**Patrón:** Component Story Format (CSF 3) + Attribute Directive · **Principio:** DRY (un solo mapa de colores en @aula/ui-tokens) · **Paradigma:** Declarativo' } } },
  // `moduleMetadata` (Storybook Angular): importa la directiva standalone en la plantilla de la historia
  decorators: [moduleMetadata({ imports: [LevelTintDirective] })],
  // [render]: una directiva no se monta sola → plantilla con un host que consume `--lvl` y `--lvl-deep` (sintaxis Tailwind v4 `border-(--var)`)
  render: (args) => ({
    props: args,
    template: `
      <article [aulaLevel]="level" class="max-w-xs rounded-2xl border-2 border-(--lvl) p-4">
        <span class="inline-block rounded-full bg-(--lvl-deep) px-3 py-1 text-sm font-semibold text-white">{{ level ?? 'Sin nivel' }}</span>
        <p class="mt-2">Tarjeta teñida con el color del nivel.</p>
      </article>`,
  }),
  args: { level: 'B1' },
  // `control: 'select'` (Storybook): desplegable en el panel Controls
  argTypes: { level: { control: 'select', options: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', null] } },
} satisfies Meta<Args>; // `satisfies` (TS 4.9): valida el tipo sin ensancharlo → inferencia exacta (Type-Safe)

export default meta;
type Story = StoryObj<Args>;

export const B1: Story = {};
export const SinNivel: Story = { args: { level: null } }; // null → morado de marca (valor por defecto del mapa)

// [TodosLosNiveles]: las 6 bandas lado a lado → revisar contraste en cada tema de la barra de herramientas
export const TodosLosNiveles: Story = {
  render: () => ({
    props: { levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
    // `@for` (Angular 17+): control de flujo integrado · `track` obligatorio para reutilizar nodos del DOM
    template: `
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        @for (l of levels; track l) {
          <div [aulaLevel]="l" class="rounded-xl border-2 border-(--lvl) p-3">
            <span class="rounded-full bg-(--lvl-deep) px-2 py-0.5 text-sm font-semibold text-white">{{ l }}</span>
          </div>
        }
      </div>`,
  }),
};
