import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { activeHrefFor, initialsFromName, isNavGroup, MOBILE_NAV_ID, NAV_BY_ROLE, navEntries, ROLE_GRADIENT, type NavItem } from '@aula/shared-nav/navigation';
import { SessionService } from '@core/auth/session.service';
import { I18nService } from '@core/i18n/i18n.service';
import { PortalNavService } from '@core/layout/portal-nav.service';
import { IconComponent } from '../../atoms/icon/icon.component';
// [PortalSidebarComponent · Organismo]: el MISMO sidebar de Next.js (PortalSidebar.tsx) — mismos ítems por rol, textos, iconos, clases y pie de usuario | [Patrón]: Atomic Design (organismo) + Configuration-Driven UI (NAV_BY_ROLE) | [Principio]: DRY + SSOT (config/navigation.ts de Next.js) | [Paradigma]: Declarativo + Reactivo
// [Navegación]: ítem `hard` = pantalla Angular → routerLink (sin recargar) · resto = página de Next.js → <a href> (navegación completa, mismo origen)
// [A11y]: <nav> con nombre, `aria-current="page"` en el ítem activo, drawer `invisible` cerrado (sus enlaces no reciben foco) y «reducir movimiento»

@Component({
  selector: 'aula-portal-sidebar',
  imports: [RouterLink, IconComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    @let shell = i18n.shell();
    @let u = user();
    <!-- [Overlay]: oscurece el fondo con el drawer abierto; clic fuera = cerrar (solo < lg) -->
    @if (menu.open()) {
      <div (click)="menu.open.set(false)" class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" aria-hidden="true"></div>
    }
    <aside
      [id]="navId"
      [attr.data-rail]="rail() ? '' : null"
      class="group fixed left-0 top-0 z-50 flex h-dvh w-[260px] max-w-[85vw] flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-border bg-card p-5 transition-[transform,visibility] duration-300 motion-reduce:transition-none lg:sticky lg:z-auto lg:data-[rail]:w-[72px] lg:data-[rail]:px-3"
      [class]="menu.open() ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible lg:translate-x-0'"
    >
      <!-- [Cerrar drawer]: el botón del topbar queda bajo el overlay → cierre dentro del propio panel (solo < lg) -->
      <button type="button" (click)="menu.open.set(false)" [attr.aria-label]="shell.nav.closeMenu" class="absolute right-3 top-3 grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
        <aula-icon name="x" [size]="20" />
      </button>
      <!-- [Cabecera]: logo + botón contraer a la derecha (como Claude web / Gemini) · en riel solo queda el botón, centrado -->
      <div class="mb-3 flex items-center justify-between gap-2 border-b border-border pb-5 lg:group-data-[rail]:justify-center">
      <a href="/" class="flex min-w-0 items-center gap-2.5 text-lg font-bold lg:group-data-[rail]:hidden">
        <span class="grid size-9 place-items-center rounded-xl bg-gradient-brand text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
            <path d="M12 2a3 3 0 0 0-3 3 3 3 0 0 0-3 3 3 3 0 0 0 0 6 3 3 0 0 0 3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0 3-3 3 3 0 0 0 0-6 3 3 0 0 0-3-3 3 3 0 0 0-3-3z" />
          </svg>
        </span>
        <!-- ponytail: nombre por defecto de BRAND (config/brand.ts usa process.env, que no existe en Angular); si se cambia por env, cambiarlo aquí -->
        <span class="truncate">Aula de Idiomas</span>
      </a>
      <!-- [Contraer/expandir]: solo ≥ lg | botón fantasma, mismas clases que SidebarToggleButton de Next.js | cookie compartida -->
      <button type="button" (click)="menu.toggleCollapsed()" [attr.aria-label]="rail() ? shell.nav.showSidebar : shell.nav.hideSidebar" [title]="rail() ? shell.nav.showSidebar : shell.nav.hideSidebar" [attr.aria-expanded]="!rail()" [attr.aria-controls]="navId" class="hidden size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid">
        <aula-icon [name]="rail() ? 'panel-left-open' : 'panel-left-close'" [size]="20" />
      </button>
      </div>

      <nav class="flex flex-col gap-1" [attr.aria-label]="shell.nav.mainNav">
        <div class="px-3 pb-1.5 pt-3 text-[11px] uppercase tracking-wider text-muted-foreground/80 lg:group-data-[rail]:sr-only">{{ shell.roles[role()] }}</div>
        <!-- [Enlace del menú]: plantilla reutilizada por los ítems sueltos y los de un grupo -->
        <ng-template #link let-item>
          @let active = item.href === activeHref();
          @if (item.hard) {
            <a [routerLink]="item.href" (click)="menu.open.set(false)" [attr.aria-current]="active ? 'page' : null" [attr.title]="rail() ? label(item) : null" [class]="active ? activeCls : idleCls">
              <aula-icon [name]="item.icon" [size]="18" />
              <span class="lg:group-data-[rail]:sr-only">{{ label(item) }}</span>
            </a>
          } @else {
            <a [href]="item.href" [attr.aria-current]="active ? 'page' : null" [attr.title]="rail() ? label(item) : null" [class]="active ? activeCls : idleCls">
              <aula-icon [name]="item.icon" [size]="18" />
              <span class="lg:group-data-[rail]:sr-only">{{ label(item) }}</span>
            </a>
          }
        </ng-template>
        @for (entry of entries(); track $index) {
          @if (isGroup(entry)) {
            <!-- [Grupo «Actividades» · 2026-10-19]: desplegable (WAI-ARIA Disclosure), igual que Next.js; abierto si una subsección está activa -->
            @let hasActive = groupActive(entry.items);
            @let expanded = openGroups()[entry.group] ?? hasActive;
            <button type="button" [attr.aria-expanded]="expanded" [attr.aria-controls]="'nav-group-' + entry.group" (click)="toggleGroup(entry.group, !expanded)" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:group-data-[rail]:hidden" [class]="hasActive ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'">
              <aula-icon [name]="entry.icon" [size]="18" />
              <span class="flex-1 text-left">{{ shell.nav[entry.labelKey] }}</span>
              <span aria-hidden="true" class="text-xs transition-transform motion-reduce:transition-none" [class.rotate-180]="expanded">▾</span>
            </button>
            <div [id]="'nav-group-' + entry.group" class="ml-5 flex-col gap-1 border-l border-border pl-2 lg:group-data-[rail]:ml-0 lg:group-data-[rail]:flex lg:group-data-[rail]:border-l-0 lg:group-data-[rail]:pl-0" [class.flex]="expanded" [class.hidden]="!expanded">
              @for (item of entry.items; track item.href) {
                <ng-container *ngTemplateOutlet="link; context: { $implicit: item }" />
              }
            </div>
          } @else {
            <ng-container *ngTemplateOutlet="link; context: { $implicit: entry }" />
          }
        }
      </nav>

      <div class="mt-auto flex items-center gap-3 border-t border-border pt-4 lg:group-data-[rail]:justify-center">
        <div class="grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" [style.background]="u.gradient" [attr.title]="rail() ? u.name : null">{{ u.initials }}</div>
        <!-- [Riel]: solo el avatar; cerrar sesión sigue en el menú de perfil del topbar -->
        <div class="min-w-0 flex-1 lg:group-data-[rail]:hidden">
          <b class="block truncate text-sm">{{ u.name }}</b>
          <!-- [Cerrar sesión]: mismo texto y estilo que LogoutButton de Next.js -->
          <button type="button" (click)="session.logout()" class="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-danger">
            <aula-icon name="log-out" /> Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  `,
})
export class PortalSidebarComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly session = inject(SessionService);
  protected readonly menu = inject(PortalNavService);
  private readonly router = inject(Router);
  protected readonly navId = MOBILE_NAV_ID;
  // [Clases]: idénticas al NavLink de Next.js (activo = degradado suave de marca) | [Principio]: DRY dentro del componente
  private readonly base = 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:group-data-[rail]:justify-center lg:group-data-[rail]:px-0'; // [Riel]: icono centrado (igual que Next.js)
  protected readonly activeCls = `${this.base} bg-gradient-soft font-semibold text-primary`;
  protected readonly idleCls = `${this.base} text-muted-foreground hover:bg-muted hover:text-foreground`;
  // [Riel de iconos]: contraído en escritorio (patrón Claude web / Gemini) → `data-rail` en el <aside> + variantes `lg:group-data-[rail]:` de Tailwind; el drawer móvil no cambia (solo clases `lg:`)
  protected readonly rail = this.menu.collapsed;

  // [Ruta actual]: `toSignal` (Angular) convierte los NavigationEnd del router en signal | sin query ni hash
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly role = this.session.portalRole;
  protected readonly items = computed(() => NAV_BY_ROLE[this.role()]);
  protected readonly entries = computed(() => navEntries(this.items())); // [2026-10-19]: con grupos desplegables
  protected readonly isGroup = isNavGroup;
  protected readonly openGroups = signal<Record<string, boolean>>({});
  // [label]: nombre del ítem (la variable de <ng-template> no tiene tipo → se resuelve aquí con NavItem)
  protected label(item: NavItem): string {
    return this.i18n.shell().nav[item.labelKey];
  }
  protected groupActive(items: readonly NavItem[]): boolean {
    return items.some((i) => i.href === this.activeHref());
  }
  protected toggleGroup(group: string, open: boolean): void {
    this.openGroups.update((g) => ({ ...g, [group]: open }));
  }
  // [activeHref]: misma función pura que Next.js → el ítem activo coincide en los dos frontends
  protected readonly activeHref = computed(() => activeHrefFor(this.url().split(/[?#]/)[0] ?? '/', this.items()));
  protected readonly user = computed(() => {
    const role = this.role();
    const name = this.session.displayName() || this.i18n.shell().roles[role];
    return { name, initials: initialsFromName(name), gradient: ROLE_GRADIENT[role] };
  });
}
