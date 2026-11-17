// [Historias · TextInputComponent]: campo de texto/área de texto con estados válido, inválido y deshabilitado | [Patrón]: CSF 3 + Atomic Design (atom) + Two-way binding (`model`) | [Principio]: SRP | [Paradigma]: Declarativo + Reactivo
import type { Meta, StoryObj } from '@storybook/angular';
import { TextInputComponent } from './text-input.component';

const meta = {
  title: 'UI/Atoms/TextInput',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Campo de texto/área de texto con estados válido, inválido y deshabilitado.\n\n**Patrón:** CSF 3 + Atomic Design (atom) + Two-way binding (`model`) · **Principio:** SRP · **Paradigma:** Declarativo + Reactivo' } } },
  component: TextInputComponent,
  // [render]: <label for> + campo → nombre accesible (WCAG 1.3.1); axe falla sin él
  render: (args) => ({
    props: args,
    template: `
      <div class="grid max-w-sm gap-2">
        <label class="text-sm font-semibold" [attr.for]="inputId">Palabra</label>
        <aula-text-input [inputId]="inputId" [value]="value" [type]="type" [placeholder]="placeholder" [invalid]="invalid" [disabled]="disabled" [multiline]="multiline" [rows]="rows" />
      </div>`,
  }),
  args: { inputId: 'word', value: '', type: 'text', placeholder: 'Escribe una palabra', invalid: false, disabled: false, multiline: false, rows: 4 },
} satisfies Meta<TextInputComponent>;

export default meta;
type Story = StoryObj<TextInputComponent>;

export const Default: Story = {};
export const Invalid: Story = { args: { invalid: true, value: '123' } }; // `invalid` → aria-invalid="true"
export const Disabled: Story = { args: { disabled: true, value: 'bloqueado' } };
export const Multiline: Story = { args: { multiline: true, placeholder: 'Escribe tu redacción…' } }; // <textarea> con `rows`
