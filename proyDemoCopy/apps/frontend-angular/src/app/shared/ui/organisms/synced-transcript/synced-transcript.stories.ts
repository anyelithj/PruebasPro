// [Historias · SyncedTranscriptComponent]: texto sincronizado con el audio (línea actual, seguir, saltar a línea, traducción) | [Patrón]: CSF 3 + Atomic Design (organismo) + Composite (lista de TranscriptLine) | [Principio]: DRY (canciones, diálogos y conversación) | [Paradigma]: Declarativo + Reactivo
import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { SAMPLE_LINES } from '../../molecules/transcript-line/transcript-line.stories'; // Mismos datos que la molécula | [Principio]: DRY
import { SyncedTranscriptComponent, type TranscriptLabels } from './synced-transcript.component';

const LABELS: TranscriptLabels = { original: 'Original', translation: 'Traducción', follow: 'Seguir la línea que suena' };

const meta = {
  title: 'UI/Organisms/SyncedTranscript',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Texto sincronizado con el audio (línea actual, seguir, saltar a línea, traducción).\n\n**Patrón:** CSF 3 + Atomic Design (organismo) + Composite (lista de TranscriptLine) · **Principio:** DRY (canciones, diálogos y conversación) · **Paradigma:** Declarativo + Reactivo' } } },
  component: SyncedTranscriptComponent,
  args: { lines: SAMPLE_LINES, labels: LABELS, language: 'en', current: -1, progress: null, follow: true, seekable: true, seek: fn(), followChange: fn() },
  argTypes: { current: { control: { type: 'range', min: -1, max: 2, step: 1 } } }, // -1 = nada sonando
} satisfies Meta<SyncedTranscriptComponent>;

export default meta;
type Story = StoryObj<SyncedTranscriptComponent>;

export const Stopped: Story = {};
export const Playing: Story = { args: { current: 1, progress: 0.5 } }; // Segunda línea resaltada con avance karaoke
