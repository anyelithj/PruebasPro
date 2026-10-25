import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MOBILE_NAV_ID, ROLE_GRADIENT, initialsFromName } from '@aula/shared-nav/navigation';
import { fmt } from '@aula/shared-i18n';
import { SessionService } from '@core/auth/session.service';
import { CartService } from '@core/cart/cart.service';
import { I18nService } from '@core/i18n/i18n.service';
import { PortalNavService } from '@core/layout/portal-nav.service';
import { IconComponent } from '../../atoms/icon/icon.component';
import { DropdownComponent } from '../../molecules/dropdown/dropdown.component';
import { LanguageMenuComponent, ThemeMenuComponent } from './portal-toolbar.component';
// [PortalTopbarComponent · Organismo]: barra superior del portal — réplica de PortalTopbar.tsx de Next.js: hamburguesa · buscador · notificaciones · carrito · tema · idioma · perfil | [Patrón]: Composite + Content Projection (la campana la aporta la funcionalidad notifications) | [Principio]: SRP (cada menú en su componente) + DRY (todos sobre Dropdown) + DIP (shared no importa funcionalidades) | [Paradigma]: Declarativo + Reactivo
// [Responsive]: móvil → fila 1: hamburguesa + iconos, fila 2: buscador a todo el ancho (`order-last basis-full`) · desde sm todo en una fila

// [Botón cuadrado]: mismas clases que MobileNavButton de Next.js (contraer el sidebar vive en la cabecera del propio sidebar) | [Principio]: DRY
const SQUARE = 'size-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// ── Carrito ── mismo localStorage que Next.js; el pago se hace en /checkout
@Component({
  selector: 'aula-cart-menu',
  imports: [RouterLink, DropdownComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.shell().topbar;
    @let items = cart.items();
    <aula-dropdown #dd [label]="t.cart + (items.length ? ' (' + items.length + ')' : '')" triggerClass="size-9 justify-center" panelRole="dialog" panelClass="w-80 max-w-[calc(100vw-2rem)]">
      <aula-icon trigger name="shopping-cart" />
      @if (items.length > 0) {
        <span badge class="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-white" aria-hidden="true">{{ items.length > 9 ? '9+' : items.length }}</span>
      }
      <div class="border-b border-border px-4 py-2.5"><b class="text-sm"><aula-icon name="shopping-cart" /> {{ t.cart }}</b></div>
      @if (!items.length) {
        <p class="px-4 py-6 text-center text-xs text-muted-foreground">{{ t.cartEmpty }}</p>
      } @else {
        <ul class="max-h-72 overflow-y-auto">
          @for (i of items; track i.id) {
            <li class="flex items-center gap-2 border-b border-border px-4 py-2.5 last:border-0">
              <span class="size-2.5 shrink-0 rounded-full" [style.background]="i.color" aria-hidden="true"></span>
              <!-- href (no routerLink): el detalle del curso vive en Next.js -->
              <a [href]="i.href" class="min-w-0 flex-1 truncate text-xs font-semibold text-foreground hover:text-primary">{{ i.title }}</a>
              <span class="eeg-mono text-xs">{{ money(i.price) }}</span>
              <button type="button" (click)="cart.remove(i.id)" [attr.aria-label]="fmt(t.remove, { title: i.title })" class="btn btn-ghost btn-sm px-2! text-tone-danger">✕</button>
            </li>
          }
        </ul>
        <div class="space-y-2 border-t border-border px-4 py-3">
          <div class="flex justify-between text-sm">
            <span>{{ t.total }}</span>
            <b class="eeg-mono">{{ money(cart.total()) }}</b>
          </div>
          <!-- [Sprint 7.4]: el pago (Stripe embebido) vive en la pantalla Angular /checkout → routerLink (misma app, sin recargar) -->
          <a routerLink="/checkout" (click)="dd.close()" aria-describedby="checkout-soon" class="btn btn-primary btn-sm w-full">{{ t.checkout }}</a>
          <p id="checkout-soon" class="text-center text-[10px] text-muted-foreground">{{ t.checkoutSoon }}</p>
        </div>
      }
    </aula-dropdown>
  `,
})
export class CartMenuComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly cart = inject(CartService);
  protected readonly fmt = fmt;

  // `Intl.NumberFormat` (ECMA-402): moneda con el formato del idioma activo (igual que Next.js)
  protected money(v: number): string {
    return new Intl.NumberFormat(this.i18n.intl(), { style: 'currency', currency: this.cart.currency() }).format(v);
  }
}

// ── Menú de perfil ──
@Component({
  selector: 'aula-profile-menu',
  imports: [RouterLink, DropdownComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let t = i18n.shell().topbar;
    @let u = user();
    <aula-dropdown [label]="t.profileMenu" triggerClass="py-1 pl-1 pr-2.5" panelClass="w-60">
      <span trigger class="contents">
        <span class="grid size-7 place-items-center rounded-full text-[11px] font-bold text-white" [style.background]="u.gradient" aria-hidden="true">{{ u.initials }}</span>
        <span class="hidden max-w-28 truncate lg:inline">{{ u.name }}</span>
        <aula-icon name="chevron-down" [size]="12" class="opacity-60" />
      </span>
      <div class="border-b border-border px-4 py-3">
        <b class="block truncate text-sm">{{ u.name }}</b>
        <span class="block truncate text-[11px] text-muted-foreground">{{ u.email }}</span>
        <span class="badge mt-1.5 bg-tone-brand-soft text-tone-brand">{{ u.roleLabel }}</span>
      </div>
      <a href="/profile/edit" role="menuitem" [class]="item"><aula-icon name="user-round" /> {{ t.myProfile }}</a>
      <a href="/profile" role="menuitem" [class]="item"><aula-icon name="trending-up" /> {{ t.myProgress }}</a>
      <!-- [Sprint 7.4]: historial de pagos (pantalla Angular) -->
      <a routerLink="/pagos" role="menuitem" [class]="item"><aula-icon name="credit-card" /> {{ t.myPayments }}</a>
      <a routerLink="/wallet" role="menuitem" [class]="item"><aula-icon name="wallet" /> {{ t.myWallet }}</a>
      <a routerLink="/certificados" role="menuitem" [class]="item"><aula-icon name="graduation-cap" /> {{ t.myCertificates }}</a>
      <div class="border-t border-border p-1">
        <button type="button" (click)="logout()" [disabled]="leaving()" class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-danger disabled:opacity-50">
          <aula-icon name="log-out" /> {{ leaving() ? 'Saliendo...' : 'Cerrar sesión' }}
        </button>
      </div>
    </aula-dropdown>
  `,
})
export class ProfileMenuComponent {
  protected readonly i18n = inject(I18nService);
  private readonly session = inject(SessionService);
  protected readonly leaving = signal(false);
  protected readonly item = 'block px-4 py-2 text-sm text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none';
  // [user]: mismos datos que arma el layout de Next.js desde el JWT (nombre, email, rol, iniciales, degradado)
  protected readonly user = computed(() => {
    const role = this.session.portalRole();
    const name = this.session.displayName() || this.i18n.shell().roles[role];
    return { name, email: this.session.user()?.email ?? '', roleLabel: this.i18n.shell().roles[role], initials: initialsFromName(name), gradient: ROLE_GRADIENT[role] };
  });

  protected logout(): void {
    this.leaving.set(true);
    void this.session.logout();
  }
}

@Component({
  selector: 'aula-portal-topbar',
  imports: [IconComponent, CartMenuComponent, ProfileMenuComponent, ThemeMenuComponent, LanguageMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let nav = i18n.shell().nav;
    @let t = i18n.shell().topbar;
    <header class="sticky top-0 z-30 -mx-4 mb-2 flex flex-wrap items-center gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
      <!-- [Hamburguesa]: solo < lg | aria-expanded + aria-controls anuncian el estado del drawer -->
      <button type="button" (click)="menu.open.set(!menu.open())" [attr.aria-label]="menu.open() ? nav.closeMenu : nav.openMenu" [attr.aria-expanded]="menu.open()" [attr.aria-controls]="navId" class="grid lg:hidden" [class]="square">
        <aula-icon [name]="menu.open() ? 'x' : 'menu'" [size]="20" />
      </button>
      <!-- [Buscador]: <form method="get" action="/courses"> nativo (página de Next.js) → funciona sin JS y deja la búsqueda en la URL -->
      <form action="/courses" method="get" role="search" class="relative order-last min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1 md:max-w-sm">
        <label for="topbar-search" class="sr-only">{{ t.searchLabel }}</label>
        <aula-icon name="search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input id="topbar-search" name="search" type="search" [placeholder]="t.search" class="control w-full rounded-full pl-9" />
      </form>
      <div class="ml-auto flex items-center gap-1.5">
        <ng-content />
        <aula-cart-menu />
        <aula-theme-menu />
        <aula-language-menu />
        <aula-profile-menu />
      </div>
    </header>
  `,
})
export class PortalTopbarComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly menu = inject(PortalNavService);
  protected readonly navId = MOBILE_NAV_ID;
  protected readonly square = SQUARE;
}
