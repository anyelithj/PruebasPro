// [Historias · DropdownComponent]: botón + panel desplegable (menu/dialog) con proyección de disparador, insignia y contenido | [Patrón]: CSF 3 + Atomic Design (molécula) + Content Projection (slots) | [Principio]: OCP (el contenido lo pone quien lo usa) | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { DropdownComponent } from './dropdown.component';

const meta = {
  title: 'UI/Molecules/Dropdown',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Botón + panel desplegable (menu/dialog) con proyección de disparador, insignia y contenido.\n\n**Patrón:** CSF 3 + Atomic Design (molécula) + Content Projection (slots) · **Principio:** OCP (el contenido lo pone quien lo usa) · **Paradigma:** Declarativo' } } },
  component: DropdownComponent,
  // [render]: `[trigger]` y `[badge]` (atributos) eligen el slot de <ng-content select> | el resto va al panel
  render: (args) => ({
    props: args,
    template: `
      <aula-dropdown [label]="label" [panelRole]="panelRole">
        <span trigger>Idioma</span>
        <span badge class="rounded-full bg-primary px-1.5 text-[10px] text-white">3</span>
        <a role="menuitem" href="#" class="block px-3 py-1.5 hover:bg-muted">Español</a>
        <a role="menuitem" href="#" class="block px-3 py-1.5 hover:bg-muted">English</a>
      </aula-dropdown>`,
  }),
  args: { label: 'Cambiar idioma', panelRole: 'menu' },
  argTypes: { panelRole: { control: 'inline-radio', options: ['menu', 'dialog'] } }, // aria-haspopup del botón
} satisfies Meta<DropdownComponent>;

export default meta;
export const Menu: StoryObj<DropdownComponent> = {};
