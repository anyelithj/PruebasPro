import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { activeHrefFor, NAV_BY_ROLE } from '@aula/shared-nav/navigation';
import { SessionService } from '@core/auth/session.service';
import { PortalSidebarComponent } from '@shared/ui/organisms/portal-sidebar/portal-sidebar.component';
// [Spec PortalSidebar]: el sidebar de Angular pinta los MISMOS ítems que Next.js para cada rol (config/navigation.ts) y marca el activo con la misma regla | [Patrón]: Test Double (sesión falsa)

function render(role: 'estudiante' | 'docente' | 'admin') {
  TestBed.configureTestingModule({
    imports: [PortalSidebarComponent],
    providers: [
      provideRouter([]),
      // [Doble de sesión]: solo lo que lee el sidebar
      { provide: SessionService, useValue: { portalRole: signal(role), displayName: signal('Ana Pérez'), logout: jest.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(PortalSidebarComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PortalSidebarComponent', () => {
  it.each(['estudiante', 'docente', 'admin'] as const)('rol %s: mismos enlaces y orden que el sidebar de Next.js', (role) => {
    const hrefs = [...render(role).querySelectorAll('nav a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(NAV_BY_ROLE[role].map((i) => i.href));
  });

  it('muestra iniciales y nombre del usuario', () => {
    const el = render('admin');
    expect(el.textContent).toContain('AP');
    expect(el.textContent).toContain('Ana Pérez');
  });

  it('activo: el prefijo más específico gana y `also` cubre las rutas agrupadas', () => {
    expect(activeHrefFor('/estudio/recomendaciones', NAV_BY_ROLE.estudiante)).toBe('/estudio/plan');
    expect(activeHrefFor('/profile/edit', NAV_BY_ROLE.estudiante)).toBe('/profile/edit');
    expect(activeHrefFor('/reportes/exportaciones', NAV_BY_ROLE.admin)).toBe('/admin/reports');
  });
});
