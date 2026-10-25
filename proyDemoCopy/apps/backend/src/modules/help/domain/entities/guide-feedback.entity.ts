import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity GuideFeedback · Sprint 7.10]: valoración «útil / no útil» de una respuesta del Agente Guía | [Patrón]: Entity + Event Log (solo se inserta) | [Principio]: SRP | [Tecnología]: TypeORM
// [Uso]: las preguntas sin respuesta o «no útiles» son las candidatas a nuevas FAQ (informe, cap. 15)

export type GuideAnsweredBy = 'faq' | 'manual' | 'llm' | 'none';

@Entity({ name: 'guide_feedback' })
@Index(['helpful', 'createdAt'])
@Index(['userId', 'sessionId', 'messageIndex'], { unique: true }) // Una valoración por mensaje (volver a votar la reemplaza)
export class GuideFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId!: string;

  // [Mensaje]: posición de la respuesta en la conversación (0, 1, 2…) → una conversación tiene varias respuestas
  @Column({ type: 'int', name: 'message_index' })
  messageIndex!: number;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'text' })
  answer!: string;

  @Column({ type: 'varchar', length: 8, name: 'answered_by' })
  answeredBy!: GuideAnsweredBy;

  @Column({ type: 'boolean' })
  helpful!: boolean;

  @Column({ type: 'varchar', length: 200, nullable: true })
  route!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
