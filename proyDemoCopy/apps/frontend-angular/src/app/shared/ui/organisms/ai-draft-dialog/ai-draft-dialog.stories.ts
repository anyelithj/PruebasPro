// [Historias · AiDraftDialogComponent]: diálogo modal nativo (<dialog>) para revisar un borrador de IA | [Patrón]: CSF 3 + Atomic Design (organismo) + Content Projection | [Principio]: SRP (el contenido lo pone quien lo usa) | [Paradigma]: Declarativo + Reactivo
// [A11y]: <dialog> con showModal() → foco atrapado, Escape cierra y aria-labelledby apunta al título
import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { AiDraftDialogComponent } from './ai-draft-dialog.component';

const meta = {
  title: 'UI/Organisms/AiDraftDialog',
  component: AiDraftDialogComponent,
  render: (args) => ({
    props: args,
    template: `
      <aula-ai-draft-dialog [open]="open" [title]="title" [hint]="hint" [closeLabel]="closeLabel" (closed)="closed()">
        <ul class="list-disc pl-5 text-sm"><li>apple — manzana</li><li>bread — pan</li><li>cheese — queso</li></ul>
      </aula-ai-draft-dialog>`,
  }),
  args: { open: true, title: 'Borrador con IA', hint: 'Revisa las palabras antes de guardarlas', closeLabel: 'Cerrar', closed: fn() },
  // `layout: 'fullscreen'` (Storybook): el modal ocupa todo el lienzo (como en la app)
  parameters: { docs: { description: { component: 'Diálogo modal nativo (<dialog>) para revisar un borrador de IA.\n\n**Patrón:** CSF 3 + Atomic Design (organismo) + Content Projection · **Principio:** SRP (el contenido lo pone quien lo usa) · **Paradigma:** Declarativo + Reactivo' } }, layout: 'fullscreen' },
} satisfies Meta<AiDraftDialogComponent>;

export default meta;
export const Open: StoryObj<AiDraftDialogComponent> = {};
