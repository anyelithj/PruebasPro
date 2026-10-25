import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity Session]: representa un refresh-token activo (un par access/refresh = 1 sesión) | [Patrón]: Entity (DDD) + Active Record | [Principio]: SRP | [Paradigma]: POO

@Entity({ name: 'auth_sessions' })
// [Índice por usuario]: lookup eficiente al rotar/invalidar todas las sesiones de un user
@Index(['userId'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [FK suave]: no @ManyToOne para mantener Auth desacoplado de User entity (Bounded Context aparte)
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  // [Refresh token hash]: NO el token en claro (defensa en profundidad si la DB se filtra)
  @Column({ type: 'varchar', length: 255, name: 'refresh_token_hash' })
  refreshTokenHash!: string;

  // [User-Agent + IP]: trazabilidad de dispositivos (opcional, mostrar al user "tus sesiones activas")
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_agent' })
  userAgent?: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'ip_address' })
  ipAddress?: string;

  // [Expiración]: copia del exp del JWT para purga rápida sin decodificar
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  // [Revocada]: soft-revoke (sirve para auditoría posterior)
  @Column({ type: 'boolean', default: false, name: 'is_revoked' })
  isRevoked!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
