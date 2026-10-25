// refund.exception.ts => errores de dominio del módulo Refund.
import { ConflictException, NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";
import { RETURN_WINDOW_DAYS } from "../model/refund.model";

export class RefundNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Refund", id);
  }
}

export class RefundNotAllowedException extends UnprocessableException {
  constructor(windowDays = RETURN_WINDOW_DAYS) {
    super(`Solo se aceptan devoluciones de pedidos entregados en los últimos ${windowDays} días`, "REFUND_NOT_ALLOWED", { windowDays });
  }
}

export class RefundNotPendingException extends ConflictException {
  constructor() {
    super("La solicitud ya fue revisada o cancelada", "REFUND_NOT_PENDING");
  }
}

export class RefundAmountExceededException extends UnprocessableException {
  constructor(maxCents: number) {
    super(`El monto supera lo reembolsable del pedido (${maxCents})`, "REFUND_AMOUNT_EXCEEDED", { maxCents });
  }
}
