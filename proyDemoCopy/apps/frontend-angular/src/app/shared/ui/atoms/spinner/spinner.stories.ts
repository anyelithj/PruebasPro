// [Historias · SpinnerComponent]: indicador de carga con texto (visible u oculto para lectores) | [Patrón]: CSF 3 + Atomic Design (atom) | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { SpinnerComponent } from './spinner.component';

const meta = {
  title: 'UI/Atoms/Spinner',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Indicador de carga con texto (visible u oculto para lectores).\n\n**Patrón:** CSF 3 + Atomic Design (atom) · **Principio:** SRP · **Paradigma:** Declarativo' } } },
  component: SpinnerComponent,
  args: { label: 'Cargando…', visibleLabel: true },
} satisfies Meta<SpinnerComponent>;

export default meta;
type Story = StoryObj<SpinnerComponent>;

export const WithLabel: Story = {};
export const SrOnly: Story = { args: { visibleLabel: false } }; // Texto solo para el lector de pantalla (sr-only)
