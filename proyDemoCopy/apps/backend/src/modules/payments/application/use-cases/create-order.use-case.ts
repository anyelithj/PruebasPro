import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  COURSE_REPOSITORY,
  type ICourseRepository,
} from '../../../courses/domain/interfaces/course.repository.interface';
import { Order, type OrderItem } from '../../domain/entities/order.entity';
import { Money } from '../../domain/value-objects/money.vo';
// [UseCase CreateOrder · Sprint 7.3]: crea la orden desde el carrito con el total calculado en el servidor | [Patrón]: Use Case (Command) + Snapshot | [Principio]: SRP + DIP (catálogo por su puerto COURSE_REPOSITORY) | [Paradigma]: POO + async/await
// [Reglas]: curso publicado · de pago (los gratuitos usan la inscripción) · no comprado antes · una sola moneda por orden

@Injectable()
export class CreateOrderUseCase {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @Inject(COURSE_REPOSITORY) private readonly courses: ICourseRepository,
  ) {}

  async execute(userId: string, courseIds: string[]): Promise<Order> {
    const items: OrderItem[] = [];
    let total: Money | null = null; // `let` (ES2015): se acumula en el bucle
    for (const id of courseIds) {
      const course = await this.courses.findById(id);
      if (!course || !course.isPublished)
        throw new NotFoundException(`Curso ${id} no encontrado`);
      const price = Money.fromMajor(Number(course.price), course.currency); // `Number`: TypeORM entrega decimal como texto
      if (price.isZero)
        throw new BadRequestException(
          `«${course.title}» es gratuito: inscríbete sin pagar`,
        );
      const enrollment = await this.courses.getEnrollment(userId, id);
      if (enrollment?.purchasedAt)
        throw new ConflictException(`Ya tienes acceso a «${course.title}»`);
      total = total ? total.add(price) : price; // `add` lanza si se mezclan monedas
      items.push({
        courseId: id,
        title: course.title,
        amountMinor: price.amountMinor,
      });
    }
    // `!` (TS): courseIds tiene al menos 1 elemento (DTO) → total no es null
    return this.orders.save(
      this.orders.create({
        userId,
        items,
        totalMinor: total!.amountMinor,
        currency: total!.currency,
        status: 'pending',
        paidAt: null,
      }),
    );
  }
}
