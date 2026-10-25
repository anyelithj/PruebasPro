import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity EmailOutbox · Sprint 7.15 · RF-63]: correo pendiente de envío guardado ANTES de enviarlo | [Patrón]: Transactional Outbox + State (pending → sent | failed) | [Principio]: SRP + resiliencia (un SMTP caído no pierde correos: se reintentan) | [Tecnología]: TypeORM + PostgreSQL
// [Privacidad]: guarda el correo tal cual se enviará (incluye enlaces de un solo uso) → la bandeja solo la ve un ADMIN y los enlaces caducan solos

export type EmailStatus = 'pending' | 'sent' | 'failed';

@Entity({ name: 'email_outbox' })
@Index(['status', 'createdAt'])
export class EmailOutbox {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 254, name: 'to_address' })
  to!: string;

  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'text' })
  html!: string;

  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status!: EmailStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'text', name: 'last_error', nullable: true })
  lastError!: string | null;

  @Column({ type: 'timestamptz', name: 'sent_at', nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
