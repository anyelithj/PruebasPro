// [Historias · IpaLabelComponent]: transcripción fonética (AFI) con idioma declarado para el lector de pantalla | [Patrón]: CSF 3 + Atomic Design (atom) | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { IpaLabelComponent } from './ipa-label.component';

const meta = {
  title: 'UI/Atoms/IpaLabel',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Transcripción fonética (AFI) con idioma declarado para el lector de pantalla.\n\n**Patrón:** CSF 3 + Atomic Design (atom) · **Principio:** SRP · **Paradigma:** Declarativo' } } },
  component: IpaLabelComponent,
  args: { ipa: 'həˈləʊ', language: 'en', title: 'Pronunciación británica' },
} satisfies Meta<IpaLabelComponent>;

export default meta;
type Story = StoryObj<IpaLabelComponent>;

export const English: Story = {};
export const French: Story = { args: { ipa: 'bɔ̃ʒuʁ', language: 'fr', title: 'Pronunciación' } };
export const Empty: Story = { args: { ipa: null } }; // `null` → no pinta nada (sin AFI disponible)
