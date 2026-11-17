// [Historias · BackLinkComponent]: enlace «volver» (flecha + texto) sobre el <a> nativo | [Patrón]: CSF 3 + Attribute Component | [Principio]: SRP | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { BackLinkComponent } from './back-link.component';

const meta = {
  title: 'UI/Atoms/BackLink',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Enlace «volver» (flecha + texto) sobre el <a> nativo.\n\n**Patrón:** CSF 3 + Attribute Component · **Principio:** SRP · **Paradigma:** Declarativo' } } },
  component: BackLinkComponent,
  // [render]: componente de ATRIBUTO → la plantilla usa el <a> real (a11y: rol link y teclado nativos)
  render: () => ({ template: `<a aulaBackLink href="#">Volver a Música</a>` }),
} satisfies Meta<BackLinkComponent>;

export default meta;
export const Default: StoryObj<BackLinkComponent> = {};
