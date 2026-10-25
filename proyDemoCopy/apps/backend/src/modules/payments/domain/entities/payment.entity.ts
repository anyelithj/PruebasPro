import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
// [Entity Payment · Sprint 7.3]: un intento de cobro de una orden en la pasarela (sesión de Checkout) | [Patrón]: Entity (DDD) + State + Idempotency Key | [Principio]: SRP | [Tecnología]: TypeORM
// [Id propio]: `PrimaryColumn` (no autogenerado) → el id existe ANTES de llamar a Stripe y viaja en la URL de regreso y en la metadata

// [Estados]: pending → succeeded → partially_refunded | refunded · pending → failed | expired
export const PAYMENT_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'expired',
  'partially_refunded',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

@Entity({ name: 'payments' })
@Index(['userId', 'createdAt'])
@Index(['orderId'])
export class Payment {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'order_id' })
  orderId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 16 })
  provider!: string; // 'stripe'

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status!: PaymentStatus;

  // [Sesión de la pasarela]: única → un webhook repetido encuentra siempre la misma fila (idempotencia)
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'session_id' })
  sessionId!: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'payment_intent_id',
    nullable: true,
  })
  paymentIntentId!: string | null;

  // [Clave de idempotencia]: la misma petición a Stripe devuelve la misma sesión
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120, name: 'idempotency_key' })
  idempotencyKey!: string;

  @Column({ type: 'int', name: 'amount_minor' })
  amountMinor!: number;

  @Column({ type: 'int', name: 'refunded_minor', default: 0 })
  refundedMinor!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
