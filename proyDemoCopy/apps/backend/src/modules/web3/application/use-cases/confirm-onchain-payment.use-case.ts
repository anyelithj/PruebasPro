import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { web3Config } from '../../../../shared/config/web3.config';
import { BroadcastEventUseCase } from '../../../notifications/application/use-cases/broadcast-event.use-case';
import { FulfillOrderUseCase } from '../../../payments/application/use-cases/fulfill-order.use-case';
import {
  CryptoPayment,
  type CryptoPaymentStatus,
} from '../../domain/entities/crypto-payment.entity';
import {
  BLOCKCHAIN_GATEWAY,
  type BlockchainGatewayPort,
} from '../../domain/interfaces/blockchain-gateway.interface';
import { EvmAddress } from '../../domain/value-objects/evm-address.vo';
// [UseCase ConfirmOnchainPayment · Sprint 7.6]: verifica la transacción en Sepolia (remitente, red, destinatario, monto y confirmaciones) y pasa a PAGADO, FALLIDO o EXPIRADO | [Patrón]: Use Case (Command) + State Machine + Observer (evento en vivo `crypto-payment`) | [Principio]: SRP + DIP (cadena por su puerto) + DRY (la orden la completa FulfillOrderUseCase, igual que Stripe) | [Paradigma]: Asíncrono
// [Seguridad]: nunca se confía en el cliente: todo se lee de la cadena · una transacción revertida o de otra cuenta no paga

export const CRYPTO_PAYMENT_EVENT = 'crypto-payment'; // Evento efímero en GET /events → Angular /checkout/cripto/:id

@Injectable()
export class ConfirmOnchainPaymentUseCase {
  constructor(
    @InjectRepository(CryptoPayment)
    private readonly payments: Repository<CryptoPayment>,
    @Inject(BLOCKCHAIN_GATEWAY) private readonly chain: BlockchainGatewayPort,
    private readonly fulfillOrder: FulfillOrderUseCase,
    private readonly broadcast: BroadcastEventUseCase,
  ) {}

  // Devuelve el estado tras la verificación; `confirming` = el worker debe volver a consultar más tarde
  async execute(id: string): Promise<CryptoPaymentStatus> {
    const p = await this.payments.findOneBy({ id });
    if (!p || p.status !== 'confirming' || !p.txHash)
      return p?.status ?? 'failed';
    const tx = await this.chain.getTransaction(p.txHash);
    // [Sin transacción]: el nodo aún no la ve; si pasa el doble del plazo se da por fallida
    if (!tx)
      return Date.now() > p.expiresAt.getTime() + web3Config().paymentTtlMs
        ? this.finish(p, 'failed', 'Transacción no encontrada en Sepolia')
        : 'confirming';

    const problem =
      tx.chainId !== p.chainId
        ? 'Red distinta de Sepolia'
        : !EvmAddress.parse(p.walletAddress).equals(tx.from)
          ? 'El remitente no es la billetera vinculada'
          : !EvmAddress.parse(p.toAddress).equals(tx.to)
            ? 'El destinatario no es la plataforma'
            : tx.value < BigInt(p.amountWei)
              ? 'Monto insuficiente'
              : tx.status === 'reverted'
                ? 'Transacción revertida'
                : null;
    if (problem) return this.finish(p, 'failed', problem);

    const confirmations = await this.chain.getConfirmations(p.txHash);
    if (confirmations < web3Config().minConfirmations) {
      if (confirmations !== p.confirmations) {
        await this.payments.update({ id }, { confirmations });
        this.emit({ ...p, confirmations });
      }
      return 'confirming';
    }
    await this.payments.update(
      { id, status: 'confirming' },
      { status: 'paid', confirmations, paidAt: new Date() },
    );
    await this.fulfillOrder.execute(p.orderId, 'ETH de prueba (Sepolia)');
    this.emit({ ...p, status: 'paid', confirmations });
    return 'paid';
  }

  private async finish(
    p: CryptoPayment,
    status: 'failed',
    error: string,
  ): Promise<CryptoPaymentStatus> {
    await this.payments.update(
      { id: p.id, status: 'confirming' },
      { status, error },
    );
    this.emit({ ...p, status, error });
    return status;
  }

  // [emit]: progreso en vivo para la pantalla del pago (SSE por usuario) | evento efímero: si no hay pantalla abierta se pierde
  private emit(
    p: Pick<CryptoPayment, 'id' | 'userId' | 'status' | 'confirmations'> & {
      error?: string | null;
    },
  ): void {
    this.broadcast.execute({
      userId: p.userId,
      type: CRYPTO_PAYMENT_EVENT,
      data: {
        id: p.id,
        status: p.status,
        confirmations: p.confirmations,
        error: p.error ?? null,
      },
    });
  }
}
