import { Injectable, type MessageEvent } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  defer,
  filter,
  from,
  interval,
  map,
  merge,
  mergeMap,
  Subject,
  type Observable,
} from 'rxjs';
import { isUUID } from 'class-validator';
import { MoreThan, Repository } from 'typeorm';
import { Notification } from '../../domain/entities/notification.entity';
import type {
  ChannelEvent,
  NotificationChannel,
} from '../../domain/interfaces/notification.interface';
// [NotificationStreamService · Sprint 6.2]: canal en tiempo real por usuario con RxJS + reenvío por Last-Event-ID | [Patrón]: Adapter + Observer (Subject) | [Principio]: SRP + DIP | [Paradigma]: Reactivo (RxJS)
// ponytail: Subject en memoria de UNA instancia → con varias réplicas, publicar vía Redis Pub/Sub (mismo puerto NotificationChannel)

const HEARTBEAT_MS = 25_000; // Comentario SSE periódico → proxies y balanceadores no cierran la conexión inactiva
const MAX_REPLAY = 50; // Tope de notificaciones reenviadas tras una reconexión
const NOTIFICATION = 'notification'; // [SSOT]: nombre del evento de los avisos persistidos

// [Envelope del bus]: a quién va + el evento ya listo para SSE/Socket.IO
interface Envelope {
  userId: string;
  event: MessageEvent;
}

// [toEvent]: notificación → MessageEvent SSE (`id` habilita Last-Event-ID en el navegador) | [Paradigma]: Funcional (pura)
const toEvent = (n: Notification): MessageEvent => ({
  id: n.id,
  type: NOTIFICATION,
  data: n,
});

@Injectable()
export class NotificationStreamService implements NotificationChannel {
  // `Subject` (RxJS): bus caliente; cada conexión filtra solo lo suyo
  private readonly bus = new Subject<Envelope>();

  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  publish(notification: Notification): void {
    this.bus.next({
      userId: notification.userId,
      event: toEvent(notification),
    });
  }

  broadcast(userId: string, { type, data }: ChannelEvent): void {
    this.bus.next({ userId, event: { type, data: data as object } }); // Sin `id`: los efímeros no se reenvían
  }

  stream(userId: string, lastEventId?: string): Observable<MessageEvent> {
    return this.compose(userId, lastEventId, (e) => e.type === NOTIFICATION);
  }

  events(userId: string, lastEventId?: string): Observable<MessageEvent> {
    return this.compose(userId, lastEventId, () => true);
  }

  // [compose]: perdidas + en vivo (filtradas) + latido | [Principio]: DRY (stream y events comparten la tubería) | [Patrón]: Template Method funcional
  private compose(
    userId: string,
    lastEventId: string | undefined,
    accept: (e: MessageEvent) => boolean,
  ): Observable<MessageEvent> {
    // [Seguridad]: el filtro por userId vive en el servidor → nadie recibe eventos ajenos
    const live$ = this.bus.pipe(
      filter((env) => env.userId === userId && accept(env.event)),
      map((env) => env.event),
    );
    // `defer` (RxJS): la consulta corre al suscribirse, no al construir el flujo
    const missed$ = defer(() => this.missedSince(userId, lastEventId)).pipe(
      mergeMap((items) => from(items.map(toEvent))),
    );
    const heartbeat$ = interval(HEARTBEAT_MS).pipe(
      map((): MessageEvent => ({ type: 'ping', data: '' })),
    );
    // `merge` (RxJS): perdidas + en vivo + latido en un solo flujo; el cliente descarta duplicados por id
    return merge(missed$, live$, heartbeat$);
  }

  // [missedSince]: notificaciones del usuario posteriores a la última recibida (sin cabecera → nada que reenviar)
  private async missedSince(
    userId: string,
    lastEventId?: string,
  ): Promise<Notification[]> {
    // [Fix]: NestJS numera (1, 2…) los eventos sin id (efímeros) → ese Last-Event-ID no es un aviso; consultarlo rompería la columna uuid de Postgres
    if (!lastEventId || !isUUID(lastEventId)) return [];
    const last = await this.repo.findOne({
      where: { id: lastEventId, userId },
      select: { createdAt: true },
    });
    if (!last) return [];
    return this.repo.find({
      where: { userId, createdAt: MoreThan(last.createdAt) },
      order: { createdAt: 'ASC' },
      take: MAX_REPLAY,
    });
  }
}
