// [Historias · TitleGlossComponent · 2026-11-17]: título en el idioma original con su IPA y traducción debajo
// [Patrón]: CSF 3 + Atomic Design (molécula) + Facade opcional (DictionaryFacade) | [Principio]: SRP + Fail-soft (con pistas guardadas no consulta el servicio) | [Paradigma]: Declarativo + Reactivo (signals)
import type { Meta, StoryObj } from '@storybook/angular'; // `import type` (TS): solo tipos
import { TitleGlossComponent } from './title-gloss.component';

const meta = {
  title: 'UI/Molecules/TitleGloss',
  parameters: { docs: { description: { component: 'Título en el idioma original con IPA y traducción al español.\n\n**Patrón:** CSF 3 + Atomic Design (molécula) · **Principio:** SRP + Fail-soft · **Paradigma:** Declarativo + Reactivo' } } },
  component: TitleGlossComponent,
  // `input.required` (Angular): `text` y `language` son obligatorios → args por defecto
  args: { text: 'The little prince', language: 'en', ipaHint: 'ðə ˈlɪt.əl prɪns', translationHint: 'El principito' },
} satisfies Meta<TitleGlossComponent>;

export default meta;
type Story = StoryObj<TitleGlossComponent>;

export const WithHints: Story = {}; // IPA y traducción ya guardadas → se pintan sin red
export const WithSuffix: Story = { args: { suffix: 'Inglés · A2' } }; // Formato de dos líneas
export const French: Story = { args: { text: 'Le petit prince', language: 'fr', ipaHint: 'lə pə.ti pʁɛ̃s', translationHint: 'El principito' } };
