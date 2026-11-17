// [Historias · PortalSidebarComponent]: menú lateral del portal (enlaces por rol desde PortalNavService) | [Patrón]: CSF 3 + Atomic Design (organismo) | [Principio]: SSOT (@aula/shared-nav) | [Paradigma]: Declarativo + Reactivo
// [Nota]: Storybook no ejecuta provideAuth() → sesión anónima (menú público); Router = provideRouter([]) del preview
import type { Meta, StoryObj } from '@storybook/angular';
import { PortalSidebarComponent } from './portal-sidebar.component';

const meta = {
  title: 'UI/Organisms/PortalSidebar',
  component: PortalSidebarComponent,
  parameters: { docs: { description: { component: 'Menú lateral del portal (enlaces por rol desde PortalNavService).\n\n**Patrón:** CSF 3 + Atomic Design (organismo) · **Principio:** SSOT (@aula/shared-nav) · **Paradigma:** Declarativo + Reactivo' } }, layout: 'fullscreen' },
} satisfies Meta<PortalSidebarComponent>;

export default meta;
export const Anonymous: StoryObj<PortalSidebarComponent> = {};
