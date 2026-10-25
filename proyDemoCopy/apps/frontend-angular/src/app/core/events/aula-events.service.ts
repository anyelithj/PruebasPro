import { Injectable } from '@angular/core';
import { filter, fromEvent, map, type Observable } from 'rxjs';
// [AulaEventsService · core/events]: bus de eventos `aula:*` entre Angular y el shell de Next.js (mismo `window`) | [Patrón]: Observer + Mediator (window como canal común) | [Principio]: DIP (las funcionalidades no importan a Next.js ni entre sí) | [Paradigma]: Event-Driven + Reactivo
// [Tecnología]: CustomEvent (DOM) + RxJS `fromEvent`

// [Catálogo]: nombres sin prefijo → `aula:navigate`, `aula:session-expired`, `aula:report-requested`… | `as const` (TS) congela la tupla
export const AULA_EVENTS = ['navigate', 'session-expired', 'notifications-changed', 'report-requested', 'accent-changed', 'toast'] as const; // [Sprint 8.3]: accent-changed → UK/US compartido entre widgets y el shell · [2026-10-19]: toast → aviso «guardado/editado/eliminado» que pinta el shell activo (Next.js o Angular)
export type AulaEvent = (typeof AULA_EVENTS)[number];

// `providedIn: 'root'` (Angular): una instancia para toda la app (y para los Angular Elements)
@Injectable({ providedIn: 'root' })
export class AulaEventsService {
  // [publish]: `CustomEvent` con `detail` tipado; `bubbles` no hace falta (se emite en window)
  publish<T>(type: AulaEvent, detail: T): void {
    window.dispatchEvent(new CustomEvent<T>(`aula:${type}`, { detail }));
  }

  // [on]: Observable del `detail` | `fromEvent` (RxJS) añade y quita el listener al suscribirse/desuscribirse (sin fugas)
  on<T>(type: AulaEvent): Observable<T> {
    return fromEvent<CustomEvent<T>>(window, `aula:${type}`).pipe(
      filter((e) => e instanceof CustomEvent),
      map((e) => e.detail),
    );
  }
}
