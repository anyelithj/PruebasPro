import { ChangeDetectionStrategy, Component, input } from '@angular/core';
// [SpinnerComponent · Átomo]: indicador de carga accesible | [Patrón]: Atomic Design (átomo) | [Principio]: SRP | [A11y]: role="status" + texto para lectores de pantalla (el giro es decorativo)

@Component({
  selector: 'aula-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- [2026-11-16]: mismo indicador que /dashboard/admin de Next.js (LoadingSpinner): círculo grande centrado y texto visible debajo -->
    <span role="status" aria-live="polite" aria-busy="true" class="grid w-full place-items-center py-10">
      <span class="flex flex-col items-center gap-3">
        <!-- motion-safe: sin animación si el usuario pidió reducir movimiento (WCAG 2.3.3) -->
        <span class="size-10 rounded-full border-4 border-primary/20 border-t-primary motion-safe:animate-spin" aria-hidden="true"></span>
        <!-- [2026-11-16]: texto azul (text-primary) como el spinner --><span class="text-sm font-semibold text-primary" [class.sr-only]="!visibleLabel()">{{ label() }}</span>
      </span>
    </span>
  `,
})
export class SpinnerComponent {
  readonly label = input('Cargando… puede tardar unos minutos');
  readonly visibleLabel = input(true);
}
