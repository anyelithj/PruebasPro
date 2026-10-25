import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity PasswordResetToken]: token efímero single-use para recovery password | [Patrón]: Entity (DDD) + State Pattern (usedAt + expiresAt) | [Principio]: SRP

@Entity({ name: 'password_reset_tokens' })
@Index(['userId'])
@Index(['tokenHash'], { unique: true })
@Index(['expiresAt'])
export class PasswordResetToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [FK suave]: columna uuid sin @ManyToOne
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  // [Hash del token]: nunca el token en claro
  @Column({ type: 'varchar', length: 255, name: 'token_hash', unique: true })
  tokenHash!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  // [Single-use]: usedAt = NULL ⇒ token activo. TTL típico 1h
  @Column({ type: 'timestamptz', nullable: true, name: 'used_at' })
  usedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  isExpired(): boolean {
    return this.expiresAt.getTime() <= Date.now();
  }

  isUsed(): boolean {
    return this.usedAt != null;
  }

  markUsed(): void {
    this.usedAt = new Date();
  }
}
