// [Historias · ButtonComponent]: variantes, tamaños y estados del átomo `button[aulaButton]` | [Patrón]: Component Story Format (CSF 3) + Atomic Design (atom) | [Principio]: SRP (una historia = un estado) | [Paradigma]: Declarativo
// `Meta`/`StoryObj` (Storybook Angular): tipos que derivan los controles de los input() del componente (Type-Safe)
import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';

// `satisfies` (TS): valida contra Meta<ButtonComponent> sin perder el tipo inferido
const meta = {
  title: 'UI/Atoms/Button',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Variantes, tamaños y estados del átomo `button[aulaButton]`.\n\n**Patrón:** Component Story Format (CSF 3) + Atomic Design (atom) · **Principio:** SRP (una historia = un estado) · **Paradigma:** Declarativo' } } },
  component: ButtonComponent,
  // [render]: componente de ATRIBUTO → la plantilla usa el <button> nativo (a11y: teclado y rol gratis) | `props` (Storybook): enlaza los args a la plantilla
  render: (args) => ({
    props: args,
    template: `<button aulaButton type="button" [variant]="variant" [size]="size" [loading]="loading" [disabled]="disabled">Continuar</button>`,
  }),
  args: { variant: 'primary', size: 'md', loading: false, disabled: false }, // [args]: valores comunes | [Principio]: DRY
  argTypes: {
    variant: { control: 'select', options: ['primary', 'outline', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
} satisfies Meta<ButtonComponent>;

export default meta;
type Story = StoryObj<ButtonComponent>; // `type` (TS): alias del tipo de historia

export const Primary: Story = {};
export const Outline: Story = { args: { variant: 'outline' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger' } };
export const Small: Story = { args: { size: 'sm' } };
export const Large: Story = { args: { size: 'lg' } };
// `aria-busy` (WAI-ARIA): el lector anuncia «ocupado» mientras carga
export const Loading: Story = { args: { loading: true } };
// `aria-disabled` (WAI-ARIA): sigue enfocable y anunciable; el componente bloquea el clic en fase de captura
export const Disabled: Story = { args: { disabled: true } };
