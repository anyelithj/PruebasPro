import { inject, Injectable } from '@angular/core';
import { AulaEventsService } from '@core/events/aula-events.service';
// [ToastService · core/feedback · 2026-10-19]: avisos breves «registro guardado / editado / eliminado» y errores de acción | [Patrón]: Facade + Observer (evento `aula:toast` en window) | [Principio]: SRP + DIP (quien avisa no sabe qué shell lo pinta) | [Paradigma]: Event-Driven
// [Por qué un evento]: las pantallas Angular viven en su shell y los Angular Elements (<aula-exportar>, <aula-guia-widget>) dentro del de Next.js → los dos shells escuchan el mismo evento

export type ToastKind = 'success' | 'error' | 'warning' | 'info'; // [2026-10-23]: + warning
export interface Toast {
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly events = inject(AulaEventsService);

  show(kind: ToastKind, message: string): void {
    this.events.publish<Toast>('toast', { kind, message });
  }
  success(message: string): void {
    this.show('success', message);
  }
  error(message: string): void {
    this.show('error', message);
  }
}
