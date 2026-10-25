import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../domain/entities/notification.entity';
// [Casos de uso "mis notificaciones"]: listar (con contador de no leídas) y marcar como leídas | [Patrón]: Use Case (Clean Architecture) + CQRS ligero | [Principio]: SRP | [Paradigma]: POO + async/await
// [Tecnología]: TypeORM Repository inyectado por NestJS (@InjectRepository)

// `export interface` (TS): respuesta para la campana del topbar
export interface MyNotificationsView {
  items: Notification[]; // Las más recientes primero
  unread: number; // Total sin leer (para el globo rojo)
}

@Injectable()
export class ListMyNotificationsUseCase {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  // `Promise.all` (ES2015): lista y conteo en paralelo | `take: 20`: la campana solo muestra las últimas
  async execute(userId: string): Promise<MyNotificationsView> {
    const [items, unread] = await Promise.all([
      this.repo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 20,
      }),
      this.repo.count({ where: { userId, isRead: false } }),
    ]);
    return { items, unread };
  }
}

@Injectable()
export class MarkNotificationsReadUseCase {
  constructor(
    @InjectRepository(Notification)
    private readonly repo: Repository<Notification>,
  ) {}

  // [Seguridad]: el `where` incluye userId → nadie puede marcar notificaciones ajenas | `id` opcional = todas
  async execute(userId: string, id?: string): Promise<{ updated: number }> {
    const res = await this.repo.update(
      { userId, isRead: false, ...(id ? { id } : {}) },
      { isRead: true, readAt: new Date() },
    );
    return { updated: res.affected ?? 0 }; // `??` (ES2020): algunos drivers no informan `affected`
  }
}
