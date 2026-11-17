import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity LoginOtp · 2026-11-16 · 2FA]: código OTP de 6 dígitos enviado por correo como segundo factor del login | [Patrón]: Entity (DDD) + State (usedAt + expiresAt + attempts, igual que MagicLinkToken) | [Principio]: SRP + seguridad (solo el hash SHA-256; 10 min de vida; 5 intentos) | [Paradigma]: POO + Decoradores (TypeORM)

// `@Entity` (TypeORM): mapea la clase a la tabla `login_otps`
@Entity({ name: 'login_otps' })
// `@Index` (TypeORM): búsqueda e invalidación por usuario
@Index(['userId'])
export class LoginOtp {
  // [id = challengeId]: UUID que el frontend reenvía junto al código (no adivinable; el código solo vale con él)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  // [Hash del código]: SHA-256 de `userId:código` → nunca el código en claro | `char(64)` = hex de 256 bits
  @Column({ type: 'char', length: 64, name: 'code_hash' })
  codeHash!: string;

  // [Intentos fallidos]: al llegar al máximo el reto queda inservible (anti fuerza bruta de 10^6 combinaciones)
  @Column({ type: 'smallint', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  // [Un solo uso]: NULL = activo · se marca con UPDATE … WHERE used_at IS NULL (Compare-and-Set)
  @Column({ type: 'timestamptz', name: 'used_at', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
