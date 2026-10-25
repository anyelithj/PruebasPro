import { Inject, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import type { Subscription } from 'rxjs';
import type { Socket } from 'socket.io';
import jwtConfig from '../../../../shared/config/jwt.config';
import type { JwtPayload } from '../../../../shared/decorators/current-user.decorator';
import {
  NOTIFICATION_CHANNEL,
  type NotificationChannel,
} from '../../domain/interfaces/notification.interface';
// [NotificationsGateway · Sprint 6.2]: el mismo canal del usuario por WebSocket (Socket.IO) para clientes que no usan SSE (apps nativas, pruebas de carga) | [Patrón]: Adapter (puerto NotificationChannel → Socket.IO) + Observer | [Principio]: DIP + DRY (reutiliza events() del canal SSE) | [Paradigma]: Reactivo + Event-Driven
// [Seguridad]: el JWT llega en `handshake.auth.token` o en la cabecera Authorization; sin token válido se desconecta al instante · el usuario sale del token, nunca del cliente
// [Navegador]: el portal usa SSE por el BFF (cookie httpOnly); este gateway es para clientes con Bearer propio

// `@WebSocketGateway` (NestJS): namespace propio → no choca con otros gateways; CORS con las mismas listas que HTTP
@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:7000').split(','), // Mismo valor por defecto que enableCors (main.ts)
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);
  // `WeakMap` (ES2015): suscripción RxJS por socket; se libera sola si el socket se recolecta
  private readonly subs = new WeakMap<Socket, Subscription>();

  constructor(
    @Inject(NOTIFICATION_CHANNEL) private readonly channel: NotificationChannel,
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  // [handleConnection]: verifica el JWT y suscribe el socket a los eventos del usuario
  async handleConnection(client: Socket): Promise<void> {
    try {
      const raw =
        (client.handshake.auth as { token?: string } | undefined)?.token ??
        client.handshake.headers.authorization ??
        '';
      const payload = await this.jwt.verifyAsync<JwtPayload>(
        raw.replace(/^Bearer\s+/i, ''),
        { secret: this.cfg.accessSecret },
      );
      // `emit(type, data)` (Socket.IO): el nombre del evento SSE se reutiliza tal cual; los latidos no hacen falta (Socket.IO tiene ping propio)
      const sub = this.channel.events(payload.sub).subscribe((e) => {
        if (e.type !== 'ping') client.emit(e.type ?? 'message', e.data);
      });
      this.subs.set(client, sub);
    } catch {
      this.logger.debug(`Socket ${client.id} rechazado: token inválido`);
      client.disconnect(true); // `true`: cierra la conexión subyacente, no solo el namespace
    }
  }

  // [handleDisconnect]: corta la suscripción → sin fugas de memoria
  handleDisconnect(client: Socket): void {
    this.subs.get(client)?.unsubscribe();
    this.subs.delete(client);
  }
}
