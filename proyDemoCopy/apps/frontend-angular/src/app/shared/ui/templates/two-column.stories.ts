// [Historias · TwoColumnTemplate]: dos columnas que se apilan en móvil (< md) | [Patrón]: Component Story Format (CSF 3) + Atomic Design (template) + Content Projection (`[left]` / `[right]`) | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { TwoColumnTemplate } from './two-column.template';

const meta = {
  title: 'UI/Templates/TwoColumn',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Dos columnas que se apilan en móvil (< md).\n\n**Patrón:** Component Story Format (CSF 3) + Atomic Design (template) + Content Projection (`[left]` / `[right]`) · **Principio:** SRP · **Paradigma:** Declarativo' } } },
  component: TwoColumnTemplate,
  // [render]: el atributo `left`/`right` decide la columna de cada bloque proyectado
  render: () => ({
    template: `
      <aula-two-column>
        <section left aria-label="Texto original" class="rounded-xl border border-border p-4">
          <h2 class="font-semibold">Original</h2>
          <p>I goes to school every day.</p>
        </section>
        <section right aria-label="Corrección" class="rounded-xl border border-border p-4">
          <h2 class="font-semibold">Corrección</h2>
          <p>I <strong>go</strong> to school every day.</p>
        </section>
      </aula-two-column>`,
  }),
} satisfies Meta<TwoColumnTemplate>;

export default meta;
type Story = StoryObj<TwoColumnTemplate>;

export const Escritorio: Story = {};
// `parameters.viewport` (Storybook): fuerza ancho móvil → se ve el apilado en 1 columna
export const Movil: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } } };
