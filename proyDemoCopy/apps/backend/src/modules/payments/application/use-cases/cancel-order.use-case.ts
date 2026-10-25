import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../../domain/entities/order.entity';
// [UseCase CancelOrder · Sprint 7.3]: el dueño cancela una orden que aún no se pagó | [Patrón]: Use Case (Command) + State (solo pending → cancelled) | [Principio]: SRP | [Paradigma]: POO + async/await

@Injectable()
export class CancelOrderUseCase {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  async execute(userId: string, id: string): Promise<Order> {
    const order = await this.orders.findOneBy({ id, userId }); // Filtro por dueño → una orden ajena es 404
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (order.status === 'cancelled') return order; // Idempotente
    if (order.status !== 'pending')
      throw new ConflictException(
        'Solo se cancela una orden pendiente de pago',
      );
    order.status = 'cancelled';
    return this.orders.save(order);
  }
}
