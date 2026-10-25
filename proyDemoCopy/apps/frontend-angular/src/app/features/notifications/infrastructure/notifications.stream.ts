import { map, type Observable } from 'rxjs';
import { fromEventSource } from '@shared/utils/event-source';
import { NotificationSchema, type AppNotification } from '../domain/models/notifications';
// [notificationsStream · Infraestructura]: avisos en vivo por SSE (/api/notifications/stream → NestJS @Sse) con reconexión y reenvío por Last-Event-ID | [Patrón]: Adapter (EventSource → Observable de dominio) + Observer | [Principio]: SRP + DRY (reutiliza shared/utils/event-source) | [Paradigma]: Reactivo
// [Seguridad]: cada evento se valida con Zod antes de llegar a la UI

export const notificationsStream = (apiBase: string): Observable<AppNotification> =>
  fromEventSource<unknown>(`${apiBase}/notifications/stream`, ['notification']).pipe(map((m) => NotificationSchema.parse(m.data)));
