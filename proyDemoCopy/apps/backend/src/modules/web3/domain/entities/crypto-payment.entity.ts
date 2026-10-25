import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// [Entity CryptoPayment · Sprint 7.6]: pago de una orden con ETH de prueba en Sepolia | [Patrón]: Entity (DDD) + State (PENDIENTE → CONFIRMANDO → PAGADO / FALLIDO / EXPIRADO) + Idempotency Key (tx_hash único) | [Principio]: SRP | [Tecnología]: TypeORM
// [Montos]: `amount_wei` como texto decimal → PostgreSQL y JSON no pierden precisión con números de 18 decimales

export const CRYPTO_PAYMENT_STATUSES = [
  'pending',
  'confirming',
  'paid',
  'failed',
  'expired',
] as const;
export type CryptoPaymentStatus = (typeof CRYPTO_PAYMENT_STATUSES)[number];

@Entity({ name: 'crypto_payments' })
@Index(['userId', 'createdAt'])
@Index(['orderId'])
export class CryptoPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  // [Remitente esperado]: billetera vinculada por SIWE → otra cuenta que pague no cuenta
  @Column({ type: 'varchar', length: 42, name: 'wallet_address' })
  walletAddress!: string;

  @Column({ type: 'varchar', length: 42, name: 'to_address' })
  toAddress!: string;

  @Column({ type: 'int', name: 'chain_id' })
  chainId!: number;

  @Column({ type: 'varchar', length: 78, name: 'amount_wei' })
  amountWei!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: CryptoPaymentStatus;

  // [Idempotencia]: una transacción solo puede pagar un pago
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 66, name: 'tx_hash', nullable: true })
  txHash!: string | null;

  @Column({ type: 'int', default: 0 })
  confirmations!: number;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true })
  paidAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
