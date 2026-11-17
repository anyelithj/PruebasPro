// [Historias · diccionario al pulsar una palabra]: WordLookup (texto con palabras pulsables), WordCard (ficha) y WordDictionary (seleccionar cualquier palabra) | [Patrón]: CSF 3 + Atomic Design (organismo) + Facade (DictionaryFacade) + Port/Adapter (DictionaryRepository del preview) | [Principio]: DRY (un diccionario para todas las funcionalidades) | [Paradigma]: Declarativo + Reactivo
// [Nota]: la ficha consulta /api (DictionaryHttpRepository); sin backend muestra su estado de error → la historia documenta aspecto, foco y teclado
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { fn } from 'storybook/test';
import { WordCardComponent } from './word-card.component';
import { WordDictionaryComponent } from './word-dictionary.component';
import { WordLookupComponent } from './word-lookup.component';

const meta = {
  title: 'UI/Organisms/WordLookup',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'WordLookup (texto con palabras pulsables), WordCard (ficha) y WordDictionary (seleccionar cualquier palabra).\n\n**Patrón:** CSF 3 + Atomic Design (organismo) + Facade (DictionaryFacade) + Port/Adapter (DictionaryRepository del preview) · **Principio:** DRY (un diccionario para todas las funcionalidades) · **Paradigma:** Declarativo + Reactivo' } } },
  component: WordLookupComponent,
  decorators: [moduleMetadata({ imports: [WordCardComponent, WordDictionaryComponent] })],
  args: { text: 'The quick brown fox jumps over the lazy dog.', language: 'en' },
} satisfies Meta<WordLookupComponent>;

export default meta;
type Story = StoryObj<WordLookupComponent>;

export const Lookup: Story = {}; // Cada palabra es un botón → abre la ficha

// [Card]: ficha aislada (`closed` espiado en Actions)
export const Card: Story = {
  render: () => ({
    props: { closed: fn() },
    template: `<div class="relative h-72"><aula-word-card word="house" language="en" sentence="This is my house." (closed)="closed()" /></div>`,
  }),
};

// [Dictionary]: selecciona (doble clic) una palabra de un bloque con `lang` distinto de «es»
export const Dictionary: Story = {
  render: () => ({
    template: `<p lang="en" class="text-lg">Double-click any word in this sentence to look it up.</p><aula-word-dictionary />`,
  }),
};
