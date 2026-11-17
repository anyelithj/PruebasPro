import { ChangeDetectionStrategy, Component } from '@angular/core';
import { busy } from '@core/http/busy.interceptor';
import { SpinnerComponent } from './spinner.component';
// [BusyOverlayComponent · 2026-11-16]: capa sobre la pantalla con el MISMO indicador de carga (aula-spinner) mientras se crea, edita o elimina algo
// [A11y]: el spinner ya lleva role="status" + aria-live · la capa bloquea clics → sin envíos dobles | `motion-safe:fade-in`: aparece suave (sin animación si se pidió menos movimiento)

@Component({
  selector: 'aula-busy-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  template: `
    @if (busy()) {
      <div class="fixed inset-0 z-[60] grid place-items-center bg-background/60 backdrop-blur-[1px] motion-safe:animate-in motion-safe:fade-in">
        <!-- [2026-11-16]: sin caja blanca → solo spinner + texto --><aula-spinner />
      </div>
    }
  `,
})
export class BusyOverlayComponent {
  protected readonly busy = busy;
}
