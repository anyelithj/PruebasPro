import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../../courses/domain/interfaces/course.repository.interface';
import { NotificationType } from '../../../notifications/domain/entities/notification.entity';
import { PublishNotificationUseCase } from '../../../notifications/application/use-cases/publish-notification.use-case';
import { Order } from '../../domain/entities/order.entity';
// [UseCase FulfillOrder · Sprints 7.3/7.6]: orden cobrada → pagada + acceso a sus cursos + aviso en la campana | [Patrón]: Use Case (Command) + Idempotent Receiver | [Principio]: DRY (lo comparten el webhook de Stripe y la verificación on-chain de Web3) + SRP | [Paradigma]: POO + async/await
// [Idempotencia]: `UPDATE … WHERE status = 'pending'` → solo la primera confirmación (webhook repetido, segundo worker) hace el trabajo

@Injectable()
export class FulfillOrderUseCase {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository,
    private readonly notify: PublishNotificationUseCase,
  ) {}

  // `true` = esta llamada pagó la orden · `false` = ya estaba pagada (o no existe / no estaba pendiente)
  async execute(orderId: string, via: string): Promise<boolean> {
    const paidAt = new Date();
    const res = await this.orders.update(
      { id: orderId, status: 'pending' },
      { status: 'paid', paidAt },
    );
    if (!res.affected) return false;
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) return false;
    // [Acceso]: mismo registro que la compra de demostración (CourseEnrollment.purchasedAt) | `??` conserva una compra previa
    for (const item of order.items) {
      const current = await this.courses.getEnrollment(
        order.userId,
        item.courseId,
      );
      await this.courses.upsertEnrollment(order.userId, item.courseId, {
        purchasedAt: current?.purchasedAt ?? paidAt,
      });
    }
    await this.notify.execute({
      userId: order.userId,
      type: NotificationType.SYSTEM,
      title: 'Pago confirmado',
      body: `Pago con ${via}: ya tienes acceso a ${order.items.map((i) => `«${i.title}»`).join(', ')}.`,
      href: '/courses',
      email: true, // [Sprint 7.15]: el comprobante también llega por correo
    });
    return true;
  }
}
