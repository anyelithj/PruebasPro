// [Historias · VoiceRecorderComponent]: grabadora de voz (MediaRecorder) con límite de tiempo y transcripción | [Patrón]: CSF 3 + Atomic Design (organismo) + State (inactivo/grabando/lista/denegado) | [Principio]: SRP | [Paradigma]: Reactivo + Orientado a eventos
// [Nota]: grabar pide permiso de micrófono al navegador; sin permiso muestra `denied`
import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { VoiceRecorderComponent, type RecorderLabels } from './voice-recorder.component';

const LABELS: RecorderLabels = {
  start: 'Grabar',
  stop: 'Detener',
  recording: 'Grabando…',
  ready: 'Grabación lista',
  denied: 'Permite el micrófono para grabar',
};

const meta = {
  title: 'UI/Organisms/VoiceRecorder',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Grabadora de voz (MediaRecorder) con límite de tiempo y transcripción.\n\n**Patrón:** CSF 3 + Atomic Design (organismo) + State (inactivo/grabando/lista/denegado) · **Principio:** SRP · **Paradigma:** Reactivo + Orientado a eventos' } } },
  component: VoiceRecorderComponent,
  args: { labels: LABELS, language: 'en', maxSeconds: 120, disabled: false, recorded: fn(), started: fn(), transcript: fn() },
} satisfies Meta<VoiceRecorderComponent>;

export default meta;
type Story = StoryObj<VoiceRecorderComponent>;

export const Ready: Story = {};
export const Disabled: Story = { args: { disabled: true } };
export const ShortLimit: Story = { args: { maxSeconds: 10 } }; // Corta sola a los 10 s
