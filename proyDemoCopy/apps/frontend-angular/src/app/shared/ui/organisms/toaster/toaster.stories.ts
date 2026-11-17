// [Historias · ToasterComponent]: avisos efímeros (role="status"/"alert") que llegan por el bus AulaEvents | [Patrón]: CSF 3 + Atomic Design (organismo) + Observer (evento «toast») | [Principio]: SRP + bajo acoplamiento (quien avisa no conoce al toaster) | [Paradigma]: Reactivo
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { ToastService, type ToastKind } from '@core/feedback/toast.service';
import { ButtonComponent } from '../../atoms/button/button.component';
import { ToasterComponent } from './toaster.component';

// [ToasterDemo]: componente SOLO de la historia — botones que publican avisos con el ToastService real | [Patrón]: Test Harness
// `@Component` (Angular): decorador que declara un componente standalone
@Component({
  selector: 'aula-toaster-demo',
  imports: [ToasterComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap gap-2">
      @for (k of kinds; track k) {
        <button aulaButton type="button" variant="outline" size="sm" (click)="toast.show(k, 'Aviso de tipo ' + k)">{{ k }}</button>
      }
    </div>
    <aula-toaster />`,
})
class ToasterDemoComponent {
  protected readonly toast = inject(ToastService); // `inject` (Angular): DI funcional → mismo servicio que usa la app
  protected readonly kinds: readonly ToastKind[] = ['success', 'info', 'warning', 'error'];
}

const meta = {
  title: 'UI/Organisms/Toaster',
  // [docs.description]: texto visible arriba de la página de documentación (autodocs) | [Principio]: Documentación viva
  parameters: { docs: { description: { component: 'Avisos efímeros (role="status"/"alert") que llegan por el bus AulaEvents.\n\n**Patrón:** CSF 3 + Atomic Design (organismo) + Observer (evento «toast») · **Principio:** SRP + bajo acoplamiento (quien avisa no conoce al toaster) · **Paradigma:** Reactivo' } } },
  component: ToasterDemoComponent,
} satisfies Meta<ToasterDemoComponent>;

export default meta;
export const Interactive: StoryObj<ToasterDemoComponent> = {}; // Pulsa un botón → aparece el aviso (4 s; error 7 s)
