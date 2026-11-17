// [Historias · AvatarStageComponent]: escenario del avatar con estado (escucha, piensa, habla, canta) anunciado en texto | [Patrón]: CSF 3 + Atomic Design (organismo) + State (AvatarState) | [Principio]: SRP | [Paradigma]: Declarativo + Reactivo
import type { Meta, StoryObj } from '@storybook/angular';
import { AvatarStageComponent } from './avatar-stage.component';
import type { AvatarStateLabels } from './avatar-state';

// `Record<AvatarState, string>` (TS): el compilador exige un texto por estado (Type-Safe)
const LABELS: AvatarStateLabels = { idle: 'En espera', listening: 'Escuchando…', thinking: 'Pensando…', speaking: 'Hablando', singing: 'Cantando' };

const meta = {
  title: 'UI/Organisms/AvatarStage',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Escenario del avatar con estado (escucha, piensa, habla, canta) anunciado en texto.\n\n**Patrón:** CSF 3 + Atomic Design (organismo) + State (AvatarState) · **Principio:** SRP · **Paradigma:** Declarativo + Reactivo' } } },
  component: AvatarStageComponent,
  args: { labels: LABELS, state: 'idle', level: 0, name: 'Aula', size: 132, variant: 'brand' },
  argTypes: {
    state: { control: 'select', options: ['idle', 'listening', 'thinking', 'speaking', 'singing'] },
    level: { control: { type: 'range', min: 0, max: 1, step: 0.05 } }, // Volumen 0..1 → apertura de boca
  },
} satisfies Meta<AvatarStageComponent>;

export default meta;
type Story = StoryObj<AvatarStageComponent>;

export const Idle: Story = {};
export const Listening: Story = { args: { state: 'listening' } };
export const Thinking: Story = { args: { state: 'thinking' } };
export const Speaking: Story = { args: { state: 'speaking', level: 0.7 } };
export const Singing: Story = { args: { state: 'singing', level: 0.5, variant: 'alt' } };
