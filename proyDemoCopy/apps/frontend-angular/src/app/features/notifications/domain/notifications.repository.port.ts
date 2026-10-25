import type { Observable } from 'rxjs';
import type { AppNotification, Inbox } from './models/notifications';
// [Puerto NotificationsRepository · Dominio]: leer la bandeja, marcar leídas y recibir avisos en vivo | [Patrón]: Port (Hexagonal) + Repository + Observer (`live`) | [Principio]: DIP + ISP
// `abstract class` (TS): contrato + token de inyección de Angular

export abstract class NotificationsRepository {
  abstract inbox(): Observable<Inbox>;
  abstract markRead(id: string): Observable<unknown>;
  abstract markAllRead(): Observable<unknown>;
  // [live]: flujo de avisos nuevos (SSE con reconexión); se cierra al desuscribirse
  abstract live(): Observable<AppNotification>;
}
