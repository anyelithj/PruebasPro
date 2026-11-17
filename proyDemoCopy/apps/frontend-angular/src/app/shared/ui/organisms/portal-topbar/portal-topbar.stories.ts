// [Historias · barra superior del portal]: PortalTopbar + menús de tema, idioma, carrito y perfil + bandera | [Patrón]: CSF 3 + Atomic Design (organismo) + Composite (la barra compone los menús) | [Principio]: SRP (un menú = un componente) | [Paradigma]: Declarativo + Reactivo
// [Nota]: sesión anónima (sin provideAuth) → perfil y carrito en estado de invitado
import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { FlagComponent, LanguageMenuComponent, ThemeMenuComponent } from './portal-toolbar.component';
import { CartMenuComponent, PortalTopbarComponent, ProfileMenuComponent } from './portal-topbar.component';

const meta = {
  title: 'UI/Organisms/PortalTopbar',
  component: PortalTopbarComponent,
  // `moduleMetadata.imports`: componentes standalone que usan las historias de abajo
  decorators: [moduleMetadata({ imports: [FlagComponent, ThemeMenuComponent, LanguageMenuComponent, CartMenuComponent, ProfileMenuComponent] })],
  parameters: { docs: { description: { component: 'PortalTopbar + menús de tema, idioma, carrito y perfil + bandera.\n\n**Patrón:** CSF 3 + Atomic Design (organismo) + Composite (la barra compone los menús) · **Principio:** SRP (un menú = un componente) · **Paradigma:** Declarativo + Reactivo' } }, layout: 'fullscreen' },
} satisfies Meta<PortalTopbarComponent>;

export default meta;
type Story = StoryObj<PortalTopbarComponent>;

export const Topbar: Story = {};
// [Menús sueltos]: cada uno se documenta aislado (mismo aspecto que dentro de la barra)
export const ThemeMenu: Story = { render: () => ({ template: `<aula-theme-menu />` }) };
export const LanguageMenu: Story = { render: () => ({ template: `<aula-language-menu />` }) };
export const CartMenu: Story = { render: () => ({ template: `<aula-cart-menu />` }) };
export const ProfileMenu: Story = { render: () => ({ template: `<aula-profile-menu />` }) };
// [Flags]: `locale` tipado con Locale de @aula/shared-i18n
export const Flags: Story = { render: () => ({ template: `<div class="flex gap-3"><aula-flag locale="es" [size]="24" /><aula-flag locale="en" [size]="24" /></div>` }) };
