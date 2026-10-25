import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity Refund · Sprint 7.3]: reembolso total o parcial de un pago, pedido por un ADMIN | [Patrón]: Entity (DDD) + Audit Trail (quién y por qué) | [Principio]: SRP | [Tecnología]: TypeORM

export type RefundStatus = 'pending' | 'succeeded' | 'failed';

@Entity({ name: 'refunds' })
@Index(['paymentId'])
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'payment_id' })
  paymentId!: string;

  @Column({ type: 'int', name: 'amount_minor' })
  amountMinor!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: RefundStatus;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'provider_refund_id',
    nullable: true,
  })
  providerRefundId!: string | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  // [Auditoría]: ADMIN que lo pidió
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
