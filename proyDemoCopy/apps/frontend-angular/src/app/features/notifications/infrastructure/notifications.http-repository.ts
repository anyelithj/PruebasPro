import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { API_URL } from '@core/http/api-url.token';
import { NotificationsRepository } from '../domain/notifications.repository.port';
import { InboxSchema, type AppNotification, type Inbox } from '../domain/models/notifications';
import { notificationsStream } from './notifications.stream';
// [NotificationsHttpRepository · Infraestructura]: implementa el puerto con HttpClient (/api/notifications/*) y SSE | [Patrón]: Adapter + Repository | [Principio]: SRP (único lugar con HTTP) + DIP | [Paradigma]: Reactivo

@Injectable()
export class NotificationsHttpRepository extends NotificationsRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  inbox(): Observable<Inbox> {
    return this.http.get<unknown>(`${this.api}/notifications/me`).pipe(map((r) => InboxSchema.parse(r)));
  }

  markRead(id: string): Observable<unknown> {
    // `encodeURIComponent`: el id nunca altera la ruta
    return this.http.patch(`${this.api}/notifications/${encodeURIComponent(id)}/read`, {});
  }

  markAllRead(): Observable<unknown> {
    return this.http.patch(`${this.api}/notifications/me/read`, {});
  }

  live(): Observable<AppNotification> {
    return notificationsStream(this.api);
  }
}
