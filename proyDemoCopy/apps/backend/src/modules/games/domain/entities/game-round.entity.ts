import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity GameRound · Sprint 8.5 · RF-105]: una ronda — estímulo, respuesta, evaluación y tiempos (el juego no premia solo acertar) | [Patrón]: Entity (DDD) | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'game_rounds' })
@Index(['sessionId', 'index'])
export class GameRound {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'int' })
  index!: number; // 1, 2, 3… dentro de la sesión

  @Column({ type: 'text', default: '' })
  prompt!: string; // Estímulo (palabra, frase, pregunta o turno del agente)

  @Column({ type: 'text', default: '' })
  answer!: string; // Lo que respondió el usuario (texto o transcripción)

  @Column({ type: 'boolean', nullable: true })
  correct!: boolean | null; // null = juego abierto (sin respuesta única)

  @Column({ type: 'int', name: 'time_to_answer_ms', nullable: true })
  timeToAnswerMs!: number | null;

  @Column({ type: 'int', name: 'duration_ms', nullable: true })
  durationMs!: number | null;

  @Column({ type: 'int', name: 'words_produced', default: 0 })
  wordsProduced!: number;

  // `jsonb`: respuesta del agente, eventos del motor y detalle de la evaluación
  @Column({ type: 'jsonb', default: () => "'{}'" })
  evaluation!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
