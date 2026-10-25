import { IconComponent } from '@shared/ui/atoms/icon/icon.component';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AulaEventsService } from '@core/events/aula-events.service';
import type { Toast } from '@core/feedback/toast.service';
import { I18nService } from '@core/i18n/i18n.service';
// [ToasterComponent · Organismo · 2026-10-19]: pinta los avisos `aula:toast` del shell Angular (abajo a la derecha; se cierran solos) | [Patrón]: Observer + Presentational | [Principio]: SRP | [Paradigma]: Reactivo (signals + RxJS)
// [A11y]: role="status" (éxito) / role="alert" (error) · botón cerrar con nombre · no roba el foco · animación solo con motion-safe

interface Shown extends Toast {
  id: number;
  ms: number;
}

const ICONS = { success: 'check', error: 'triangle-alert', warning: 'triangle-alert', info: 'info' } as const; // [2026-10-23]: icono por tipo

@Component({
  selector: 'aula-toaster',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol
      class="pointer-events-none fixed bottom-20 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      [attr.aria-label]="i18n.t().common.notifications"
    >
      @for (t of toasts(); track t.id) {
        <!-- [2026-10-23]: diseño .toast compartido con Next.js (globals.css) -->
        <li [attr.role]="t.kind === 'error' ? 'alert' : 'status'" [attr.data-kind]="t.kind" class="toast" [style.--toast-ms]="t.ms + 'ms'">
          <span class="toast-icon" aria-hidden="true"><aula-icon [name]="icons[t.kind]" /></span>
          <span class="min-w-0 flex-1">
            <strong class="toast-title">{{ i18n.t().common.toastTitle[t.kind] }}</strong>
            <span class="toast-msg">{{ t.message }}</span>
          </span>
          <button type="button" class="toast-close" [attr.aria-label]="i18n.t().common.close" (click)="dismiss(t.id)">
            <aula-icon name="x" />
          </button>
          <span class="toast-bar" aria-hidden="true"></span>
        </li>
      }
    </ol>
  `,
})
export class ToasterComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly toasts = signal<Shown[]>([]);
  protected readonly icons = ICONS;
  private seq = 0;

  constructor() {
    inject(AulaEventsService)
      .on<Toast>('toast')
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((t) => {
        const id = ++this.seq;
        const ms = t.kind === 'error' ? 7000 : 4000;
        this.toasts.update((l) => [...l.slice(-3), { ...t, id, ms }]); // Máximo 4 a la vez
        setTimeout(() => this.dismiss(id), ms);
      });
  }

  protected dismiss(id: number): void {
    this.toasts.update((l) => l.filter((t) => t.id !== id));
  }
}
