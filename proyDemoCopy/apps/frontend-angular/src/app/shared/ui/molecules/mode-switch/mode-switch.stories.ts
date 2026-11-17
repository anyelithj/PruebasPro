// [Historias · ModeSwitchComponent]: selector segmentado (fieldset + radios) con ayuda por opción | [Patrón]: CSF 3 + Atomic Design (molécula) + Two-way binding (`model.required`) | [Principio]: SRP | [Paradigma]: Declarativo + Reactivo
import type { Meta, StoryObj } from '@storybook/angular';
import { ModeSwitchComponent, type ModeOption } from './mode-switch.component';

// [OPTIONS]: `readonly ModeOption[]` (TS): lista inmutable tipada → mismo contrato que el input
const OPTIONS: readonly ModeOption[] = [
  { value: 'practice', label: 'Práctica', hint: 'Sin nota; puedes repetir' },
  { value: 'exam', label: 'Examen', hint: 'Cuenta para tu progreso' },
];

const meta = {
  title: 'UI/Molecules/ModeSwitch',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Selector segmentado (fieldset + radios) con ayuda por opción.\n\n**Patrón:** CSF 3 + Atomic Design (molécula) + Two-way binding (`model.required`) · **Principio:** SRP · **Paradigma:** Declarativo + Reactivo' } } },
  component: ModeSwitchComponent,
  args: { legend: 'Modo de actividad', name: 'mode', options: OPTIONS, value: 'practice' },
} satisfies Meta<ModeSwitchComponent>;

export default meta;
type Story = StoryObj<ModeSwitchComponent>;

export const Practice: Story = {};
export const Exam: Story = { args: { value: 'exam' } };
