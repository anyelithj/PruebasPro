// [Historias · LanguageChipsComponent]: filtro de idioma con chips (radiogroup) a partir de LANGUAGES compartido | [Patrón]: CSF 3 + Atomic Design (molécula) + Two-way binding (`model`) | [Principio]: SSOT (@aula/shared-schemas) | [Paradigma]: Declarativo + Reactivo
import type { Meta, StoryObj } from '@storybook/angular';
import { LanguageChipsComponent } from './language-chips.component';

const meta = {
  title: 'UI/Molecules/LanguageChips',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Filtro de idioma con chips (radiogroup) a partir de LANGUAGES compartido.\n\n**Patrón:** CSF 3 + Atomic Design (molécula) + Two-way binding (`model`) · **Principio:** SSOT (@aula/shared-schemas) · **Paradigma:** Declarativo + Reactivo' } } },
  component: LanguageChipsComponent,
  args: { label: 'Filtrar por idioma', value: '', allowAll: true, allLabel: 'Todos' },
} satisfies Meta<LanguageChipsComponent>;

export default meta;
type Story = StoryObj<LanguageChipsComponent>;

export const AllSelected: Story = {};
export const EnglishSelected: Story = { args: { value: 'en' } };
export const WithoutAll: Story = { args: { allowAll: false, value: 'fr' } }; // Sin chip «Todos»: siempre hay un idioma elegido
