import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../../users/domain/value-objects/role.vo';
import { Order } from '../../domain/entities/order.entity';
// [UseCases ListMyOrders + GetOrder · Sprint 7.3]: historial de órdenes del usuario y detalle (solo dueño o ADMIN) | [Patrón]: Query (CQRS ligero) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + async/await

@Injectable()
export class ListMyOrdersUseCase {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  // `take: 50`: las más recientes (la pantalla no pagina)
  execute(userId: string): Promise<Order[]> {
    return this.orders.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}

@Injectable()
export class GetOrderUseCase {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  // [Seguridad]: una orden ajena responde 404 (no revela que existe)
  async execute(user: { sub: string; role: Role }, id: string): Promise<Order> {
    const order = await this.orders.findOneBy({ id });
    if (!order || (order.userId !== user.sub && user.role !== Role.ADMIN))
      throw new NotFoundException('Orden no encontrada');
    return order;
  }
}
