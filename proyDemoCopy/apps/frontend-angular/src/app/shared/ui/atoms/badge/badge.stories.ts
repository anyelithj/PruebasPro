// [Historias · BadgeComponent]: tonos de la etiqueta de estado (texto + icono, nunca solo color · WCAG 1.4.1) | [Patrón]: Component Story Format (CSF 3) + Atomic Design (atom) | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';

const meta = {
  title: 'UI/Atoms/Badge',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Tonos de la etiqueta de estado (texto + icono, nunca solo color · WCAG 1.4.1).\n\n**Patrón:** Component Story Format (CSF 3) + Atomic Design (atom) · **Principio:** SRP · **Paradigma:** Declarativo' } } },
  component: BadgeComponent,
  // [render]: `<ng-content />` necesita plantilla para proyectar el texto
  render: (args) => ({
    props: args,
    template: `<aula-badge [tone]="tone" [icon]="icon">Publicado</aula-badge>`,
  }),
  args: { tone: 'brand', icon: 'check' },
  argTypes: { tone: { control: 'select', options: ['brand', 'info', 'warning', 'danger', 'muted'] } },
} satisfies Meta<BadgeComponent>;

export default meta;
type Story = StoryObj<BadgeComponent>;

export const Brand: Story = {};
export const Info: Story = { args: { tone: 'info', icon: 'bell' } };
export const Warning: Story = { args: { tone: 'warning', icon: 'alert' } };
export const Danger: Story = { args: { tone: 'danger', icon: 'trash' } };
export const Muted: Story = { args: { tone: 'muted', icon: null } }; // Sin icono: el texto ya transmite el estado
