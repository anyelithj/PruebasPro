// [Historias · WordTokenComponent]: palabra pulsable del lector (abre la tarjeta del diccionario) con estado aprendiendo/aprendida | [Patrón]: CSF 3 + Atomic Design (molécula) | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { WordTokenComponent } from './word-token.component';

const meta = {
  title: 'UI/Molecules/WordToken',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Palabra pulsable del lector (abre la tarjeta del diccionario) con estado aprendiendo/aprendida.\n\n**Patrón:** CSF 3 + Atomic Design (molécula) · **Principio:** SRP · **Paradigma:** Declarativo' } } },
  component: WordTokenComponent,
  // [render]: frase de contexto alrededor → se ve cómo fluye en línea con el texto
  render: (args) => ({
    props: args,
    template: `<p class="text-lg">I like <aula-word-token [text]="text" [language]="language" [status]="status" [statusLabel]="statusLabel" [open]="open" [label]="label" (picked)="picked($event)" /> every day.</p>`,
  }),
  args: { text: 'reading', language: 'en', status: null, statusLabel: '', open: false, first: false, label: 'Ver «{w}» en el diccionario', picked: fn() },
  argTypes: { status: { control: 'select', options: [null, 'learning', 'learned'] } },
} satisfies Meta<WordTokenComponent>;

export default meta;
type Story = StoryObj<WordTokenComponent>;

export const Default: Story = {};
export const Learning: Story = { args: { status: 'learning', statusLabel: 'Aprendiendo' } };
export const Learned: Story = { args: { status: 'learned', statusLabel: 'Aprendida' } };
export const Open: Story = { args: { open: true } }; // Tarjeta abierta → aria-expanded="true"
