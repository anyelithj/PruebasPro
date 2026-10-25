import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { web3Config } from '../../../../shared/config/web3.config';
import type { Role } from '../../../users/domain/value-objects/role.vo';
import { GetOrderUseCase } from '../../../payments/application/use-cases/list-my-orders.use-case';
import { CryptoPayment } from '../../domain/entities/crypto-payment.entity';
import { Wallet } from '../../domain/entities/wallet.entity';
import {
  BLOCKCHAIN_GATEWAY,
  type BlockchainGatewayPort,
} from '../../domain/interfaces/blockchain-gateway.interface';
// [UseCase CreateCryptoPayment · Sprint 7.6]: pago PENDIENTE de una orden en ETH de prueba (tasa fija de demostración) hacia la dirección de la plataforma | [Patrón]: Use Case (Command) + Idempotencia (reutiliza el pago vigente de la orden) | [Principio]: SRP + DRY (la orden la lee Payments) + DIP | [Paradigma]: POO + async/await
// [Reglas]: orden pendiente del usuario · billetera vinculada por SIWE · solo Sepolia · caduca a los WEB3_PAYMENT_TTL_MIN minutos

@Injectable()
export class CreateCryptoPaymentUseCase {
  constructor(
    @InjectRepository(CryptoPayment)
    private readonly payments: Repository<CryptoPayment>,
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @Inject(BLOCKCHAIN_GATEWAY) private readonly chain: BlockchainGatewayPort,
    private readonly getOrder: GetOrderUseCase,
  ) {}

  async execute(
    user: { sub: string; role: Role },
    orderId: string,
  ): Promise<CryptoPayment> {
    if (!this.chain.enabled || !this.chain.platformAddress)
      throw new ServiceUnavailableException(
        'Web3 no configurado: define WEB3_RPC_URL y la cuenta de la plataforma',
      );
    const order = await this.getOrder.execute(user, orderId); // 404 si es ajena
    if (order.status !== 'pending')
      throw new ConflictException('La orden ya no está pendiente de pago');
    const wallet = await this.wallets.findOne({
      where: { userId: user.sub },
      order: { linkedAt: 'DESC' },
    });
    if (!wallet)
      throw new ConflictException(
        'Vincula una billetera en /wallet antes de pagar con criptomonedas',
      );

    // [Idempotencia]: si ya hay un pago vigente para la orden, se devuelve el mismo
    const current = await this.payments.findOne({
      where: [
        { orderId, status: 'pending', expiresAt: MoreThan(new Date()) },
        { orderId, status: 'confirming' },
      ],
    });
    if (current) return current;

    const cfg = web3Config();
    return this.payments.save(
      this.payments.create({
        orderId,
        userId: user.sub,
        walletAddress: wallet.address,
        toAddress: this.chain.platformAddress,
        chainId: this.chain.chainId,
        amountWei: (BigInt(order.totalMinor) * cfg.weiPerCent).toString(), // centavos × wei por centavo (bigint, sin redondeos)
        status: 'pending',
        txHash: null,
        confirmations: 0,
        error: null,
        expiresAt: new Date(Date.now() + cfg.paymentTtlMs),
        paidAt: null,
      }),
    );
  }
}
