// [Historias · IconComponent]: iconos SVG del remoto (decorativos o con etiqueta accesible) | [Patrón]: CSF 3 + Atomic Design (atom) + Lookup Table (PATHS) | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { IconComponent } from './icon.component';

const meta = {
  title: 'UI/Atoms/Icon',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Iconos SVG del remoto (decorativos o con etiqueta accesible).\n\n**Patrón:** CSF 3 + Atomic Design (atom) + Lookup Table (PATHS) · **Principio:** SRP · **Paradigma:** Declarativo' } } },
  component: IconComponent,
  args: { name: 'bell', size: 24, label: '' },
} satisfies Meta<IconComponent>;

export default meta;
type Story = StoryObj<IconComponent>;

export const Decorative: Story = {}; // `label` vacío → aria-hidden (el texto vecino ya informa)
export const WithLabel: Story = { args: { name: 'alert', label: 'Atención' } }; // Con `label` → role="img" + nombre accesible (WCAG 1.1.1)

// [Gallery]: muestrario de iconos frecuentes | `props` (Storybook): datos de la plantilla | `@for` (Angular 17+): bucle de control de flujo con `track`
export const Gallery: Story = {
  render: () => ({
    props: { names: ['bell', 'send', 'download', 'trash', 'file', 'check', 'alert', 'spark', 'pen', 'book', 'refresh', 'users'] },
    template: `
      <ul class="grid grid-cols-6 gap-4">
        @for (n of names; track n) {
          <li class="flex flex-col items-center gap-1 text-xs text-muted-foreground"><aula-icon [name]="n" [size]="24" />{{ n }}</li>
        }
      </ul>`,
  }),
};
