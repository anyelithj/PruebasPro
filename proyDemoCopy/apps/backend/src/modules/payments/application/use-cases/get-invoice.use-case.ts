import { ConflictException, Injectable } from '@nestjs/common';
import type { Role } from '../../../users/domain/value-objects/role.vo';
import { invoiceNumber, invoicePdf } from '../../infrastructure/invoices/invoice-pdf';
import { GetOrderUseCase } from './list-my-orders.use-case';
// [UseCase GetInvoice · Sprint 2.6]: factura PDF de una orden PAGADA o REEMBOLSADA (dueño o ADMIN) | [Patrón]: Use Case (Query) + reutiliza GetOrderUseCase (misma regla de acceso) | [Principio]: DRY + SRP | [Paradigma]: POO + async/await
// ponytail: se genera al vuelo (milisegundos); guardarla en el almacén si se exige inmutabilidad fiscal

@Injectable()
export class GetInvoiceUseCase {
  constructor(private readonly orders: GetOrderUseCase) {}

  async execute(user: { sub: string; role: Role; email: string }, id: string): Promise<{ filename: string; pdf: Buffer }> {
    const order = await this.orders.execute(user, id); // 404 si es ajena
    if (order.status !== 'paid' && order.status !== 'refunded')
      throw new ConflictException('La factura está disponible cuando la orden está pagada');
    return { filename: `factura-${invoiceNumber(order)}.pdf`, pdf: await invoicePdf(order, order.userId === user.sub ? user.email : `usuario ${order.userId}`) }; // ADMIN: identifica al dueño por su id
  }
}
