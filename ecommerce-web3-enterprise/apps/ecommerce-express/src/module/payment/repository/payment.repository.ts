// payment.repository.ts => acceso a datos de pagos, eventos de webhook (idempotencia) y reembolsos.
import { Prisma, type PaymentStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import type { PaymentDto } from "../dto/payment.dto";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

const PAYMENT_SELECT = {
  id: true,
  userId: true,
  checkoutSessionId: true,
  orderId: true,
  provider: true,
  providerPaymentId: true,
  amountCents: true,
  refundedCents: true,
  currency: true,
  status: true,
  failureReason: true,
  details: true, // RF-08.3/08.9 cotización cripto o datos de la transferencia
  createdAt: true,
} satisfies Prisma.PaymentSelect;

export type PaymentRow = Prisma.PaymentGetPayload<{ select: typeof PAYMENT_SELECT }>;

export class PaymentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  public async findMany(userId: string | undefined, status: PaymentStatus | undefined, page: PageParams, provider?: string): Promise<Paginated<PaymentDto>> {
    const where: Prisma.PaymentWhereInput = { ...(userId ? { userId } : {}), ...(status ? { status } : {}), ...(provider ? { provider } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({ where, select: PAYMENT_SELECT, orderBy: { createdAt: "desc" }, skip: page.skip, take: page.limit }),
      this.prisma.payment.count({ where }),
    ]);
    return { items: rows.map(toDto), total };
  }

  public async findById(id: string): Promise<PaymentRow | null> {
    return this.prisma.payment.findUnique({ where: { id }, select: PAYMENT_SELECT });
  }

  public async findByProviderId(providerPaymentId: string): Promise<PaymentRow | null> {
    return this.prisma.payment.findUnique({ where: { providerPaymentId }, select: PAYMENT_SELECT });
  }

  // findOpenForCheckout => pago en curso de la sesión (se reutiliza su PaymentIntent si el monto no cambió)
  public async findOpenForCheckout(checkoutSessionId: string): Promise<PaymentRow | null> {
    return this.prisma.payment.findFirst({
      where: { checkoutSessionId, provider: "STRIPE", status: { in: ["PENDING", "REQUIRES_ACTION"] } }, // Solo intentos de Stripe
      select: PAYMENT_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  // findSucceededForOrder => pago cobrado de un pedido (para reembolsar)
  public async findSucceededForOrder(orderId: string): Promise<PaymentRow | null> {
    return this.prisma.payment.findFirst({
      where: { orderId, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } },
      select: PAYMENT_SELECT,
    });
  }

  public async create(data: Prisma.PaymentUncheckedCreateInput): Promise<PaymentRow> {
    return this.prisma.payment.create({ data, select: PAYMENT_SELECT });
  }

  public async update(id: string, data: Prisma.PaymentUncheckedUpdateInput): Promise<PaymentRow> {
    return this.prisma.payment.update({ where: { id }, data, select: PAYMENT_SELECT });
  }

  // registerWebhookEvent => true si el evento es NUEVO; false si ya se procesó (Stripe reintenta entregas).
  // La PK del evento (evt_...) hace de candado de idempotencia: el segundo INSERT falla con P2002.
  public async registerWebhookEvent(id: string, type: string, payload: Prisma.InputJsonValue): Promise<boolean> {
    try {
      await this.prisma.paymentWebhookEvent.create({ data: { id, type, payload } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
      throw error;
    }
  }

  // reopenCheckout => tras fallo/anulación del pago, la sesión vuelve al paso de pago (el cliente reintenta)
  public async reopenCheckout(checkoutSessionId: string): Promise<void> {
    await this.prisma.checkoutSession.updateMany({ where: { id: checkoutSessionId, status: "PAYMENT_PENDING" }, data: { status: "ADDRESS_SET" } });
  }

  // markRefundProcessed => registra el resultado de Stripe en la devolución y en el pago (misma transacción)
  public async markRefundProcessed(refundId: string, paymentId: string, providerRefundId: string, amountCents: number, newStatus: PaymentStatus): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refund.update({
        where: { id: refundId },
        data: { status: "PROCESSED", providerRefundId, processedAt: new Date(), paymentId },
      }),
      this.prisma.payment.update({ where: { id: paymentId }, data: { refundedCents: { increment: amountCents }, status: newStatus } }),
    ]);
  }
}

export function toDto(row: PaymentRow): PaymentDto {
  const { userId: _userId, providerPaymentId: _providerPaymentId, ...payment } = row;
  return payment;
}

export const paymentRepository = new PaymentRepository(prisma);
