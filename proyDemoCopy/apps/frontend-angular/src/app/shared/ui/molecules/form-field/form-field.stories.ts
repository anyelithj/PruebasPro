// [Historias · FormFieldComponent]: etiqueta + campo proyectado + ayuda o error (role="alert") | [Patrón]: CSF 3 + Atomic Design (molécula) + Content Projection | [Principio]: DRY (misma estructura en todos los formularios) | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { TextInputComponent } from '../../atoms/text-input/text-input.component';
import { FormFieldComponent } from './form-field.component';

const meta = {
  title: 'UI/Molecules/FormField',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Etiqueta + campo proyectado + ayuda o error (role="alert").\n\n**Patrón:** CSF 3 + Atomic Design (molécula) + Content Projection · **Principio:** DRY (misma estructura en todos los formularios) · **Paradigma:** Declarativo' } } },
  component: FormFieldComponent,
  // `moduleMetadata` (Storybook Angular): importa el átomo que se proyecta dentro (componentes standalone)
  decorators: [moduleMetadata({ imports: [TextInputComponent] })],
  render: (args) => ({
    props: args,
    template: `
      <aula-form-field class="block max-w-sm" [fieldId]="fieldId" [label]="label" [hint]="hint" [error]="error">
        <span fieldAside class="type-meta text-muted-foreground">0/40</span>
        <aula-text-input [inputId]="fieldId" [invalid]="!!error" [describedBy]="fieldId + (error ? '-error' : '-hint')" />
      </aula-form-field>`,
  }),
  args: { fieldId: 'title', label: 'Título del curso', hint: 'Máximo 40 caracteres', error: '' },
} satisfies Meta<FormFieldComponent>;

export default meta;
type Story = StoryObj<FormFieldComponent>;

export const WithHint: Story = {};
export const WithError: Story = { args: { error: 'El título es obligatorio' } }; // El error sustituye a la ayuda
