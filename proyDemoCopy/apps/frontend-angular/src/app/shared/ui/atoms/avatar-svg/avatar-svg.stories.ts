// [Historias · AvatarSvgComponent]: personaje SVG con apertura de boca (0..1) y dos variantes de color | [Patrón]: Component Story Format (CSF 3) + Atomic Design (atom) | [Principio]: SRP (una historia = un estado) | [Paradigma]: Declarativo
// `Meta`/`StoryObj` (Storybook Angular): tipos que derivan los controles de los input() (Type-Safe)
import type { Meta, StoryObj } from '@storybook/angular';
import { AvatarSvgComponent } from './avatar-svg.component';

// `satisfies` (TS): valida la forma sin perder el tipo inferido
const meta = {
  title: 'UI/Atoms/AvatarSvg',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Personaje SVG con apertura de boca (0..1) y dos variantes de color.\n\n**Patrón:** Component Story Format (CSF 3) + Atomic Design (atom) · **Principio:** SRP (una historia = un estado) · **Paradigma:** Declarativo' } } },
  component: AvatarSvgComponent,
  args: { mouth: 0, size: 120, variant: 'brand' }, // [args]: valores comunes | [Principio]: DRY
  argTypes: {
    mouth: { control: { type: 'range', min: 0, max: 1, step: 0.05 } }, // `range` (Storybook): deslizador 0..1 = apertura de la boca (la calcula LipSyncService)
    variant: { control: 'inline-radio', options: ['brand', 'alt'] },
  },
} satisfies Meta<AvatarSvgComponent>;

export default meta;
type Story = StoryObj<AvatarSvgComponent>; // `type` (TS): alias del tipo de historia

export const Brand: Story = {};
export const Alt: Story = { args: { variant: 'alt' } };
export const MouthOpen: Story = { args: { mouth: 0.8 } }; // Boca abierta (al hablar)
export const Small: Story = { args: { size: 64 } };
