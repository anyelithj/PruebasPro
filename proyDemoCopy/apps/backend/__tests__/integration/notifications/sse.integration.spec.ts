import { firstValueFrom, take, toArray } from 'rxjs';
import type { Repository } from 'typeorm';
import { Notification, NotificationType } from '../../../src/modules/notifications/domain/entities/notification.entity';
import { NotificationStreamService } from '../../../src/modules/notifications/infrastructure/stream/notification-stream.service';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { JwtPayload } from '../../../src/shared/decorators/current-user.decorator';
import type { NotificationChannel } from '../../../src/modules/notifications/domain/interfaces/notification.interface';
import { SseController } from '../../../src/modules/notifications/presentation/sse.controller';
import { BroadcastEventUseCase } from '../../../src/modules/notifications/application/use-cases/broadcast-event.use-case';
import { NotificationsGateway } from '../../../src/modules/notifications/infrastructure/gateways/notifications.gateway';
// [Suite Integration SSE · Sprint 6.2]: entidad Notification + canal en tiempo real NotificationStreamService (filtro por usuario y reenvío por Last-Event-ID) | [Patrón]: Test Double (repositorio falso) | [Tecnología]: Jest + RxJS

const LAST = '5f0c1b9e-2d4a-4c6b-9e1f-0a2b3c4d5e6f'; // Last-Event-ID real: los avisos tienen id uuid

describe('NotificationsModule (integration)', () => {
  // [Fábrica de avisos]: `Object.assign` arma la entidad sin BD | [Principio]: DRY
  const make = (id: string, userId: string, at: number): Notification =>
    Object.assign(new Notification(), { id, userId, title: id, body: '', createdAt: new Date(at) });

  describe('NotificationStreamService', () => {
    it('entrega solo los avisos del usuario conectado (nunca ajenos)', async () => {
      const svc = new NotificationStreamService({} as Repository<Notification>);
      const got = firstValueFrom(svc.stream('u1').pipe(take(1)));
      svc.publish(make('x', 'u2', 1)); // De otro usuario → se filtra
      svc.publish(make('mine', 'u1', 2));
      await expect(got).resolves.toMatchObject({ id: 'mine', type: 'notification' });
    });

    it('events() entrega efímeros (broadcast) y stream() solo avisos', async () => {
      const svc = new NotificationStreamService({} as Repository<Notification>);
      const all = firstValueFrom(svc.events('u1').pipe(take(2), toArray()));
      const onlyNotif = firstValueFrom(svc.stream('u1').pipe(take(1)));
      svc.broadcast('u1', { type: 'report-export', data: { id: 'r1', status: 'ready' } });
      svc.publish(make('n1', 'u1', 1));
      expect((await all).map((e) => e.type)).toEqual(['report-export', 'notification']);
      await expect(onlyNotif).resolves.toMatchObject({ id: 'n1' });
    });

    it('al reconectar con Last-Event-ID reenvía lo perdido en orden', async () => {
      const missed = [make('b', 'u1', 2), make('c', 'u1', 3)];
      // [Repositorio falso]: findOne = última recibida · find = posteriores
      const repo = {
        findOne: jest.fn().mockResolvedValue(make(LAST, 'u1', 1)),
        find: jest.fn().mockResolvedValue(missed),
      } as unknown as Repository<Notification>;
      const svc = new NotificationStreamService(repo);
      const events = await firstValueFrom(svc.stream('u1', LAST).pipe(take(2), toArray()));
      expect(events.map((e) => e.id)).toEqual(['b', 'c']);
    });
  });

  describe('Notification entity', () => {
    it('expone el enum NotificationType con los tipos del catálogo', () => {
      expect(NotificationType.ACHIEVEMENT).toBe('ACHIEVEMENT');
      expect(NotificationType.SCORE).toBe('SCORE');
      expect(NotificationType.LOGIN_DEVICE).toBe('LOGIN_DEVICE');
      expect(NotificationType.SYSTEM).toBe('SYSTEM');
    });

    it('por defecto está no-leída y `markAsRead` actualiza estado + timestamp', () => {
      const n = new Notification();
      n.userId = 'u1';
      n.type = NotificationType.SCORE;
      n.title = 'Hola';
      n.body = 'Mensaje';

      // [Defaults]: vienen del Column.default en runtime; aquí validamos solo el método.
      expect(n.isRead).toBeUndefined();

      n.markAsRead();
      expect(n.isRead).toBe(true);
      expect(n.readAt).toBeInstanceOf(Date);
    });

    it('markAsRead es idempotente en cuanto a flag (readAt se refresca)', () => {
      const n = new Notification();
      n.markAsRead();
      const first = n.readAt as Date;
      n.markAsRead();
      expect(n.isRead).toBe(true);
      expect(n.readAt).toBeInstanceOf(Date);
      // [Refresh permitido]: la segunda llamada puede actualizar readAt — no la fijamos
      expect((n.readAt as Date).getTime()).toBeGreaterThanOrEqual(first.getTime());
    });
  });

  // [Piezas del tiempo real]: controlador SSE, caso de uso efímero y gateway sobre el mismo canal
  it('Last-Event-ID numérico (id que NestJS pone a los efímeros) no consulta la BD', async () => {
    const repo = { findOne: jest.fn(), find: jest.fn() } as unknown as Repository<Notification>;
    const svc = new NotificationStreamService(repo);
    const got = firstValueFrom(svc.events('u1', '2').pipe(take(1)));
    svc.publish(make('n9', 'u1', 9));
    await expect(got).resolves.toMatchObject({ id: 'n9' });
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  describe('SseController · BroadcastEventUseCase · NotificationsGateway', () => {
    const user = { sub: 'u1', email: 'a@b.c', role: 'USER' } as JwtPayload;

    it('SseController emite los eventos del usuario autenticado', async () => {
      const svc = new NotificationStreamService({} as Repository<Notification>);
      const got = firstValueFrom(new SseController(svc).events(user).pipe(take(1)));
      svc.publish(make('n1', 'u1', 1));
      await expect(got).resolves.toMatchObject({ id: 'n1', type: 'notification' });
    });

    it('BroadcastEventUseCase publica un efímero sin persistir', () => {
      const channel = { broadcast: jest.fn() } as unknown as NotificationChannel;
      new BroadcastEventUseCase(channel).execute({ userId: 'u1', type: 'report-export', data: { id: 'r1' } });
      expect(channel.broadcast).toHaveBeenCalledWith('u1', { type: 'report-export', data: { id: 'r1' } });
    });

    it('NotificationsGateway: token inválido desconecta; válido solo recibe lo suyo', async () => {
      const svc = new NotificationStreamService({} as Repository<Notification>);
      const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
      const gw = new NotificationsGateway(svc, jwt, { accessSecret: 's' } as never);
      const socket = () => ({ id: 'x', handshake: { auth: { token: 't' }, headers: {} }, emit: jest.fn(), disconnect: jest.fn() }) as unknown as Socket;

      (jwt.verifyAsync as jest.Mock).mockRejectedValueOnce(new Error('bad'));
      const bad = socket();
      await gw.handleConnection(bad);
      expect(bad.disconnect).toHaveBeenCalledWith(true);

      (jwt.verifyAsync as jest.Mock).mockResolvedValueOnce(user);
      const ok = socket();
      await gw.handleConnection(ok);
      svc.publish(make('ajeno', 'u2', 1));
      svc.publish(make('mio', 'u1', 2));
      expect(ok.emit).toHaveBeenCalledTimes(1);
      expect(ok.emit).toHaveBeenCalledWith('notification', expect.objectContaining({ id: 'mio' }));
      gw.handleDisconnect(ok);
    });
  });
});
