import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// [Entity Order · Sprint 7.3]: orden de compra de cursos con el total calculado en el servidor | [Patrón]: Entity (DDD) + State (status) + Snapshot (items guarda título y precio del momento) | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL (jsonb)

// [Estados]: pending → paid → refunded | pending → cancelled | expired (sesión de pago vencida sin cobro)
export const ORDER_STATUSES = [
  'pending',
  'paid',
  'cancelled',
  'expired',
  'refunded',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// [Línea]: copia del precio al crear la orden → cambiar el catálogo después no altera lo cobrado
export interface OrderItem {
  courseId: string;
  title: string;
  amountMinor: number;
}

@Entity({ name: 'orders' })
@Index(['userId', 'createdAt'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: OrderStatus;

  @Column({ type: 'jsonb' })
  items!: OrderItem[];

  // [Total]: entero en centavos (Money) | nunca viene del cliente
  @Column({ type: 'int', name: 'total_minor' })
  totalMinor!: number;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true })
  paidAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
