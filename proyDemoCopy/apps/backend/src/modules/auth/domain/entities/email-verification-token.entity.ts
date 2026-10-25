import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity EmailVerificationToken]: token efímero single-use para verificar email del usuario | [Patrón]: Entity (DDD) + State Pattern (usedAt + expiresAt) | [Principio]: SRP

@Entity({ name: 'email_verification_tokens' })
@Index(['userId'])
@Index(['tokenHash'], { unique: true })
@Index(['expiresAt'])
export class EmailVerificationToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [FK suave]: columna uuid sin @ManyToOne — preserva desacople de bounded contexts
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  // [Hash del token]: nunca el token en claro (defensa en profundidad)
  @Column({ type: 'varchar', length: 255, name: 'token_hash', unique: true })
  tokenHash!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  // [Single-use]: usedAt = NULL ⇒ token activo
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
