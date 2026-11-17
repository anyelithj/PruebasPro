// [Historias · TranscriptLineComponent]: una línea del texto sincronizado (original, AFI, traducción, hablante y avance karaoke) | [Patrón]: CSF 3 + Atomic Design (molécula) | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import type { TranscriptLine } from '../../organisms/synced-transcript/transcript-line.model';
import { TranscriptLineComponent } from './transcript-line.component';

// `export const` (ESM): datos de ejemplo reutilizados por SyncedTranscript | [Principio]: DRY
export const SAMPLE_LINES: readonly TranscriptLine[] = [
  { id: '1', text: 'Good morning, how are you?', ipa: 'ɡʊd ˈmɔːnɪŋ haʊ ɑː juː', ipaUs: 'ɡʊd ˈmɔrnɪŋ haʊ ɑr ju', translation: 'Buenos días, ¿cómo estás?', start: 0, end: 2.5, speaker: 'Anna' },
  { id: '2', text: "I'm fine, thank you.", ipa: 'aɪm faɪn θæŋk juː', translation: 'Estoy bien, gracias.', start: 2.5, end: 4.5, speaker: 'Tom' },
  { id: '3', text: 'Nice to see you again.', ipa: 'naɪs tə siː juː əˈɡen', translation: 'Me alegra verte de nuevo.', start: 4.5, end: 7, speaker: 'Anna' },
];

const meta = {
  title: 'UI/Molecules/TranscriptLine',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Una línea del texto sincronizado (original, AFI, traducción, hablante y avance karaoke).\n\n**Patrón:** CSF 3 + Atomic Design (molécula) · **Principio:** SRP · **Paradigma:** Declarativo' } } },
  component: TranscriptLineComponent,
  excludeStories: ['SAMPLE_LINES'], // `excludeStories` (Storybook): ese export son datos, no una historia
  args: { line: SAMPLE_LINES[0]!, language: 'en', accent: 'uk', current: false, progress: null, seekable: false, showTranslation: true, listenLabel: 'Escuchar', seek: fn() },
  argTypes: { accent: { control: 'inline-radio', options: ['uk', 'us'] } },
} satisfies Meta<TranscriptLineComponent>;

export default meta;
type Story = StoryObj<TranscriptLineComponent>;

export const Default: Story = {};
export const Current: Story = { args: { current: true, progress: 0.4 } }; // Línea que suena: resaltada + avance palabra a palabra
export const UsAccent: Story = { args: { accent: 'us' } }; // AFI estadounidense (ipaUs)
export const WithoutTranslation: Story = { args: { showTranslation: false } };
