// [Historias · PillNavComponent y ActivitySectionsComponent]: navegación en píldoras con RouterLinkActive | [Patrón]: CSF 3 + Atomic Design (molécula) | [Principio]: DRY (ActivitySections reutiliza PillNav con el menú de i18n) | [Paradigma]: Declarativo
import type { Meta, StoryObj } from '@storybook/angular';
import { ActivitySectionsComponent, PillNavComponent, type PillItem } from './pill-nav.component';

const ITEMS: readonly PillItem[] = [
  { label: 'Diálogos', link: '/dialogos', icon: 'messages-square' },
  { label: 'Biblioteca', link: '/dialogos/biblioteca', icon: 'book' },
  { label: 'Conversar', link: '/dialogos/conversar', icon: 'send' },
];

const meta = {
  title: 'UI/Molecules/PillNav',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Navegación en píldoras con RouterLinkActive.\n\n**Patrón:** CSF 3 + Atomic Design (molécula) · **Principio:** DRY (ActivitySections reutiliza PillNav con el menú de i18n) · **Paradigma:** Declarativo' } } },
  component: PillNavComponent, // RouterLink: `provideRouter([])` del preview (sin rutas reales → ninguna píldora activa)
  args: { label: 'Secciones de diálogos', items: ITEMS, exact: false },
} satisfies Meta<PillNavComponent>;

export default meta;

export const Default: StoryObj<PillNavComponent> = {};

// [ActivitySections]: variante con las 6 secciones de actividades traducidas (I18nService)
export const ActivitySections: StoryObj<ActivitySectionsComponent> = {
  render: () => ({ moduleMetadata: { imports: [ActivitySectionsComponent] }, template: `<aula-activity-sections />` }),
};
