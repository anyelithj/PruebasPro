import { ChangeDetectionStrategy, Component, input } from '@angular/core';
// [SpinnerComponent · Átomo]: indicador de carga accesible | [Patrón]: Atomic Design (átomo) | [Principio]: SRP | [A11y]: role="status" + texto para lectores de pantalla (el giro es decorativo)

@Component({
  selector: 'aula-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span role="status" class="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <!-- motion-safe: sin animación si el usuario pidió reducir movimiento (WCAG 2.3.3) -->
      <span class="size-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin" aria-hidden="true"></span>
      <span [class.sr-only]="!visibleLabel()">{{ label() }}</span>
    </span>
  `,
})
export class SpinnerComponent {
  readonly label = input('Cargando…');
  readonly visibleLabel = input(true);
}
