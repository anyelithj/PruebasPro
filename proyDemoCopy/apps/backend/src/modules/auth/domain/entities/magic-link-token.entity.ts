import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity MagicLinkToken · Sprints 1.5/7.18]: token de un solo uso para entrar sin contraseña | [Patrón]: Entity (DDD) + State (usedAt + expiresAt, igual que PasswordResetToken) | [Principio]: SRP + seguridad (solo se guarda el hash SHA-256; 15 min de vida)

@Entity({ name: 'magic_link_tokens' })
@Index(['userId'])
@Index(['expiresAt'])
export class MagicLinkToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  // [Hash del token]: nunca el token en claro (el enlace del correo lleva el original)
  @Column({ type: 'char', length: 64, name: 'token_hash', unique: true })
  tokenHash!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  // [Un solo uso]: NULL = activo · se marca con UPDATE … WHERE used_at IS NULL (dos clics simultáneos no abren dos sesiones)
  @Column({ type: 'timestamptz', name: 'used_at', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
