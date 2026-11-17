// [Historias · CardPageTemplate]: plantilla de página tipo ficha con sus 4 slots (pageBack, pageNav, pageActions, contenido) | [Patrón]: Component Story Format (CSF 3) + Atomic Design (template) + Content Projection | [Principio]: DRY | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { CardPageTemplate } from './card-page.template';

const meta = {
  title: 'UI/Templates/CardPage',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Plantilla de página tipo ficha con sus 4 slots (pageBack, pageNav, pageActions, contenido).\n\n**Patrón:** Component Story Format (CSF 3) + Atomic Design (template) + Content Projection · **Principio:** DRY · **Paradigma:** Declarativo' } } },
  component: CardPageTemplate,
  // [render]: `<ng-content select="[slot]">` necesita plantilla → cada atributo (pageBack, pageNav…) elige su hueco
  render: (args) => ({
    props: args,
    template: `
      <aula-card-page [heading]="heading" [subtitle]="subtitle" [bare]="bare">
        <a pageBack href="#" class="text-sm text-primary underline">← Volver a Actividades</a>
        <nav pageNav aria-label="Secciones" class="flex gap-2">
          <a href="#" aria-current="page" class="rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">Todas</a>
          <a href="#" class="rounded-full border border-border px-3 py-1 text-sm">Pendientes</a>
        </nav>
        <button pageActions type="button" class="rounded-lg border border-border px-3 py-1.5 text-sm">Filtrar</button>
        <p>Contenido principal de la página.</p>
      </aula-card-page>`,
  }),
  args: { heading: 'Mis actividades', subtitle: 'Tareas asignadas por tu docente', headingId: 'page-title', bare: false },
} satisfies Meta<CardPageTemplate>; // `satisfies` (TS): comprueba el tipo sin perder la inferencia literal

export default meta;
type Story = StoryObj<CardPageTemplate>;

export const ConTarjeta: Story = {};
export const SinTarjeta: Story = { args: { bare: true } }; // bare → contenido directo, sin caja
export const SoloTitulo: Story = {
  args: { subtitle: '' }, // Subtítulo vacío → `@if` no lo pinta
  render: (args) => ({ props: args, template: `<aula-card-page [heading]="heading" [subtitle]="subtitle"><p>Contenido.</p></aula-card-page>` }),
};
