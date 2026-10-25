import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { SIDEBAR_COOKIE } from '@aula/shared-nav/navigation'; // [SSOT]: misma cookie que lee el layout de Next.js
// [PortalNavService · core/layout]: estado del sidebar — drawer abierto (< lg) y oculto en escritorio (≥ lg) — espejo de MobileNavProvider de Next.js | [Patrón]: Singleton + State (signals) + Observer (router y teclado) | [Principio]: SRP + DIP (topbar y sidebar no se conocen) | [Paradigma]: Reactivo

// [readCollapsed]: preferencia guardada por Next.js o por Angular («1» = oculto) | `RegExp` sobre `document.cookie` (DOM)
const readCollapsed = (cookie: string): boolean => new RegExp(`(?:^|;\\s*)${SIDEBAR_COOKIE}=1(?:;|$)`).test(cookie);

@Injectable({ providedIn: 'root' })
export class PortalNavService {
  private readonly doc = inject(DOCUMENT);
  // `signal` (Angular): estado reactivo leído por el sidebar, el topbar y el marco
  readonly open = signal(false);
  readonly collapsed = signal(readCollapsed(this.doc.cookie));

  constructor() {
    // [Cerrar al navegar]: igual que Next.js, cambiar de ruta cierra el drawer | `filter` (RxJS) deja pasar solo NavigationEnd
    const sub = inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.open.set(false));
    // [Drawer abierto]: Escape cierra (WCAG 2.1.2) + bloqueo del scroll del fondo | `effect` con cleanup → sin listeners colgados
    effect((onCleanup) => {
      if (!this.open()) return;
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && this.open.set(false);
      this.doc.addEventListener('keydown', onKey);
      const prev = this.doc.body.style.overflow;
      this.doc.body.style.overflow = 'hidden';
      onCleanup(() => {
        this.doc.removeEventListener('keydown', onKey);
        this.doc.body.style.overflow = prev;
      });
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  // [toggleCollapsed]: alterna y recuerda un año en la cookie compartida → Next.js respeta la misma preferencia
  toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    this.doc.cookie = `${SIDEBAR_COOKIE}=${next ? '1' : '0'}; path=/; max-age=31536000; samesite=lax`;
  }
}
