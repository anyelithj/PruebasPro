// [Historias · PronunciationButtonComponent]: botón «Escuchar» que pide el audio al servicio de voz (ServerAudioService) | [Patrón]: CSF 3 + Atomic Design (molécula) | [Principio]: SRP | [Paradigma]: Declarativo
// [Nota]: sin backend levantado el clic no suena (la petición /api falla y el componente lo gestiona) → la historia documenta aspecto y a11y
import type { Meta, StoryObj } from '@storybook/angular';
import { PronunciationButtonComponent } from './pronunciation-button.component';

const meta = {
  title: 'UI/Molecules/PronunciationButton',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Botón «Escuchar» que pide el audio al servicio de voz (ServerAudioService).\n\n**Patrón:** CSF 3 + Atomic Design (molécula) · **Principio:** SRP · **Paradigma:** Declarativo' } } },
  component: PronunciationButtonComponent,
  args: { text: 'Good morning', language: 'en', rate: 0.9, label: 'Escuchar' },
} satisfies Meta<PronunciationButtonComponent>;

export default meta;
type Story = StoryObj<PronunciationButtonComponent>;

export const English: Story = {};
export const German: Story = { args: { text: 'Guten Morgen', language: 'de' } };
