// [Historias · LicenseDeclarationComponent]: declaración de licencia (tipo, fuente, titular, variante CC y confirmación) con validación en vivo | [Patrón]: CSF 3 + Atomic Design (organismo) + Specification (licenseProblem) | [Principio]: SRP + cumplimiento de derechos de autor | [Paradigma]: Declarativo + Reactivo
import type { Meta, StoryObj } from '@storybook/angular';
import { LicenseDeclarationComponent, type LicenseLabels, type LicenseValue } from './license-declaration.component';

const LABELS: LicenseLabels = {
  legend: 'Licencia del contenido',
  type: 'Tipo de licencia',
  types: { public_domain: 'Dominio público', creative_commons: 'Creative Commons', own_work: 'Obra propia', permission: 'Con permiso del titular' },
  source: 'Fuente (enlace)',
  holder: 'Titular de los derechos',
  variant: 'Variante Creative Commons',
  confirm: 'Confirmo que tengo derecho a publicar este contenido',
  hint: 'No se admiten canciones con derechos reservados sin permiso',
  problems: { holder: 'Indica el titular', source: 'Indica la fuente', variant: 'Elige la variante CC', confirm: 'Confirma los derechos' },
};

const meta = {
  title: 'UI/Organisms/LicenseDeclaration',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Declaración de licencia (tipo, fuente, titular, variante CC y confirmación) con validación en vivo.\n\n**Patrón:** CSF 3 + Atomic Design (organismo) + Specification (licenseProblem) · **Principio:** SRP + cumplimiento de derechos de autor · **Paradigma:** Declarativo + Reactivo' } } },
  component: LicenseDeclarationComponent,
  args: { labels: LABELS, value: { type: 'own_work', source: '', holder: '', variant: '', confirmed: false } },
} satisfies Meta<LicenseDeclarationComponent>;

export default meta;
type Story = StoryObj<LicenseDeclarationComponent>;

export const OwnWork: Story = {};
// `satisfies LicenseValue` (TS): comprueba el objeto contra el modelo sin ensanchar el tipo
export const CreativeCommonsIncomplete: Story = {
  args: { value: { type: 'creative_commons', source: 'https://commons.wikimedia.org', holder: '', variant: '', confirmed: false } satisfies LicenseValue },
}; // Muestra los avisos (role="alert") de lo que falta
export const PublicDomainConfirmed: Story = {
  args: { value: { type: 'public_domain', source: 'https://www.gutenberg.org', holder: 'Tradicional', variant: '', confirmed: true } satisfies LicenseValue },
};
