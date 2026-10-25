import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity DialogueSession · Sprint 9.3 · RF-122/RF-124]: conversación de un usuario con el avatar sobre un tema, en un idioma y a un nivel; el audio del usuario no se guarda (solo el texto transcrito) | [Patrón]: Entity (DDD) + State (active → ended) | [Principio]: SRP + privacidad + sin estado en FastAPI (la memoria vive aquí y en el conversationId) | [Tecnología]: TypeORM + PostgreSQL

export type DialogueSessionStatus = 'active' | 'ended';

@Entity({ name: 'dialogue_sessions' })
@Index(['userId', 'createdAt'])
export class DialogueSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'topic_id' })
  topicId!: string;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 2 })
  level!: string;

  @Column({ type: 'varchar', length: 8, default: 'active' })
  status!: DialogueSessionStatus;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'conversation_id',
    nullable: true,
  })
  conversationId!: string | null; // Memoria del agente en FastAPI

  @Column({ type: 'int', name: 'user_turns', default: 0 })
  userTurns!: number;

  @Column({ type: 'jsonb', name: 'vocabulary_used', default: () => "'[]'" })
  vocabularyUsed!: string[]; // Vocabulario clave del tema que el usuario usó

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'ended_at', nullable: true })
  endedAt!: Date | null;
}
