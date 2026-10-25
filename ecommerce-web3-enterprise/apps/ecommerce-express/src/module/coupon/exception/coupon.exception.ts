// coupon.exception.ts => errores de dominio del módulo Coupon.
import { NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";

export class CouponNotFoundException extends NotFoundException {
  constructor(idOrCode: string) {
    super("Coupon", idOrCode);
  }
}

// Se lanza cuando el checkout intenta aplicar un cupón no elegible (el motivo viaja en "details")
export class CouponNotApplicableException extends UnprocessableException {
  constructor(message: string, reason: string) {
    super(message, "COUPON_NOT_APPLICABLE", { reason });
  }
}
