import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity Notification]: notificación persistente del usuario (push offline + historial + marcar leída) | [Patrón]: Entity (DDD) + State Pattern (is_read) | [Principio]: SRP

// [Tipos de notificación]: catálogo cerrado | [Patrón]: enum como Value Object
export enum NotificationType {
  ACHIEVEMENT = 'ACHIEVEMENT',
  SCORE = 'SCORE',
  EMAIL_VERIFY = 'EMAIL_VERIFY',
  PASSWORD_RESET = 'PASSWORD_RESET',
  QUIZ_PUBLISHED = 'QUIZ_PUBLISHED',
  LOGIN_DEVICE = 'LOGIN_DEVICE',
  SYSTEM = 'SYSTEM',
}

@Entity({ name: 'notifications' })
@Index(['userId'])
@Index(['userId', 'isRead'])
@Index(['createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [FK suave]: columna uuid sin @ManyToOne
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  // [Payload]: esquema variable según type (achievementCode, quizId, sessionId, ...)
  // [Patrón]: discriminated union validado en aplicación
  @Column({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false, name: 'is_read' })
  isRead!: boolean;

  @Column({ type: 'timestamptz', nullable: true, name: 'read_at' })
  readAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  markAsRead(): void {
    this.isRead = true;
    this.readAt = new Date();
  }
}
