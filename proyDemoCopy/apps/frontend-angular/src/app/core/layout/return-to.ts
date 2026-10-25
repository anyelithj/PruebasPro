import { ChangeDetectionStrategy, Component, inject, Injectable, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop'; // [RxJS ↔ Signals]: queryParamMap como signal
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { I18nService } from '@core/i18n/i18n.service';
import { BackLinkComponent } from '@shared/ui/atoms/back-link/back-link.component';
// [ReturnTo · core/layout · 2026-10-23]: «volver» al lugar de donde se vino — Gestión → Actividades abre los editores con ?volver=/admin/activities?tab=… y, al terminar o pulsar «Volver», se regresa a ESA pestaña (antes se iba a la sección del estudiante)
// [Patrón]: Service (estado de navegación) + Attribute-free Component (enlace) | [Principio]: DRY (5 editores lo usan) + SRP | [Seguridad]: lista blanca de destinos internos → sin redirección abierta (open redirect)

// [Destinos permitidos]: solo pantallas de Gestión del propio portal (ruta relativa, sin `//` ni esquema)
const ALLOWED = /^\/admin\/activities(\?[\w=&%.-]*)?$/;
export const safeReturn = (v: string | null | undefined): string | null => (v && ALLOWED.test(v) ? v : null);

@Injectable({ providedIn: 'root' })
export class ReturnToService {
  private readonly router = inject(Router);

  // [current]: `volver` válido de la URL actual o null | lee el snapshot (no necesita suscripción)
  current(): string | null {
    return safeReturn(this.router.routerState.snapshot.root.queryParamMap.get('volver'));
  }

  // [go]: dentro del editor (crear → /:id) conservando ?volver= | `queryParamsHandling: 'preserve'` (Angular Router)
  go(commands: unknown[]): Promise<boolean> {
    return this.router.navigate(commands, { queryParamsHandling: 'preserve' });
  }

  // [leave]: al terminar (archivar, retirar…) → Gestión (página de Next.js: navegación completa) o la lista del remoto
  leave(fallback: string): void {
    const back = this.current();
    if (back) window.location.assign(back); // `location.assign` (DOM): sale de la SPA Angular hacia Next.js
    else void this.router.navigateByUrl(fallback);
  }
}

// [ReturnLinkComponent]: el «Volver a …» de los editores — con ?volver= apunta a Gestión, si no al `fallback` del remoto | [A11y]: mismo átomo aulaBackLink (icono decorativo + texto)
@Component({
  selector: 'aula-return-link',
  imports: [RouterLink, BackLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' }, // Sin caja propia: el <a> ocupa el slot pageBack
  template: `
    @if (back(); as b) {
      <a aulaBackLink [href]="b">{{ i18n.t().common.backToManagement }}</a>
    } @else {
      <a aulaBackLink [routerLink]="fallback()">{{ label() }}</a>
    }
  `,
})
export class ReturnLinkComponent {
  protected readonly i18n = inject(I18nService);
  readonly fallback = input.required<string>(); // Lista del remoto (/musica, /practica…)
  readonly label = input.required<string>();
  // `toSignal` (Angular): reactivo a cambios de query (crear → editar conserva ?volver=)
  protected readonly back = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((q) => safeReturn(q.get('volver')))), { initialValue: null });
}
