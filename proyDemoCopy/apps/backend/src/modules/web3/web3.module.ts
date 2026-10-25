import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import {
  AnchorCertificateHashUseCase,
  CERTIFICATE_ANCHOR_QUEUE,
} from './application/use-cases/anchor-certificate-hash.use-case';
import { ConfirmOnchainPaymentUseCase } from './application/use-cases/confirm-onchain-payment.use-case';
import { CreateCryptoPaymentUseCase } from './application/use-cases/create-crypto-payment.use-case';
import { CreateSiweNonceUseCase } from './application/use-cases/create-siwe-nonce.use-case';
import {
  GetCryptoPaymentUseCase,
  ListMyCryptoPaymentsUseCase,
} from './application/use-cases/get-crypto-payment.use-case';
import {
  GetWalletUseCase,
  LinkWalletUseCase,
  ListMyWalletsUseCase,
} from './application/use-cases/link-wallet.use-case';
import {
  CRYPTO_PAYMENT_QUEUE,
  RegisterCryptoTxUseCase,
} from './application/use-cases/register-crypto-tx.use-case';
import { UnlinkWalletUseCase } from './application/use-cases/unlink-wallet.use-case';
import { VerifyCertificateHashUseCase } from './application/use-cases/verify-certificate-hash.use-case';
import { CryptoPayment } from './domain/entities/crypto-payment.entity';
import { Wallet } from './domain/entities/wallet.entity';
import { BLOCKCHAIN_GATEWAY } from './domain/interfaces/blockchain-gateway.interface';
import { ViemBlockchainAdapter } from './infrastructure/chain/viem-blockchain.adapter';
import { CertificateAnchorProcessor } from './infrastructure/jobs/certificate-anchor.processor';
import { CryptoPaymentProcessor } from './infrastructure/jobs/crypto-payment.processor';
import { CryptoPaymentsController } from './presentation/crypto-payments.controller';
import { WalletsController } from './presentation/wallets.controller';
// [Web3Module · Sprints 7.5/7.6]: billetera SIWE, pago con ETH de prueba en Sepolia verificado en segundo plano y anclaje de hashes de certificados | [Patrón]: Module + DI Container + Ports & Adapters | [Principio]: DIP (BLOCKCHAIN_GATEWAY → ViemBlockchainAdapter; en pruebas FakeBlockchainAdapter) + DRY (la orden la completa Payments)

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, CryptoPayment]),
    BullModule.registerQueue(
      { name: CRYPTO_PAYMENT_QUEUE },
      { name: CERTIFICATE_ANCHOR_QUEUE },
    ), // Redis heredado de BullModule.forRootAsync
    PaymentsModule, // GetOrderUseCase + FulfillOrderUseCase
    NotificationsModule, // BroadcastEventUseCase: confirmaciones en vivo
  ],
  controllers: [WalletsController, CryptoPaymentsController],
  providers: [
    { provide: BLOCKCHAIN_GATEWAY, useClass: ViemBlockchainAdapter },
    CreateSiweNonceUseCase,
    LinkWalletUseCase,
    ListMyWalletsUseCase,
    GetWalletUseCase,
    UnlinkWalletUseCase,
    CreateCryptoPaymentUseCase,
    GetCryptoPaymentUseCase,
    ListMyCryptoPaymentsUseCase,
    RegisterCryptoTxUseCase,
    ConfirmOnchainPaymentUseCase,
    AnchorCertificateHashUseCase,
    VerifyCertificateHashUseCase,
    CryptoPaymentProcessor,
    CertificateAnchorProcessor,
  ],
  // [Sprint 7.8]: Certificates ancla y verifica el hash del PDF con estos casos de uso
  exports: [AnchorCertificateHashUseCase, VerifyCertificateHashUseCase],
})
export class Web3Module {}
