// loyalty.exception.ts => errores de dominio del módulo Loyalty.
import { NotFoundException, UnprocessableException } from "../../../shared/filter/http-exception.filter";

export class LoyaltyAccountNotFoundException extends NotFoundException {
  constructor(id: string) {
    super("Loyalty account", id);
  }
}

export class InsufficientPointsException extends UnprocessableException {
  constructor(balance: number) {
    super(`Saldo de puntos insuficiente (disponible: ${balance})`, "INSUFFICIENT_POINTS", { balance });
  }
}

// El nivel pedido aún no se alcanzó (no se certifica un logro no obtenido)
export class TierNotReachedException extends UnprocessableException {
  constructor() {
    super("El usuario aún no alcanza ese nivel", "TIER_NOT_REACHED");
  }
}

export class WalletRequiredException extends UnprocessableException {
  constructor() {
    super("Vincula una wallet a tu cuenta para recibir el NFT", "WALLET_REQUIRED");
  }
}
