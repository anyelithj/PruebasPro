import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { GameType } from '../game-type';
// [Entity GameSession · Sprint 8.5 · RF-98/RF-100]: partida de un usuario — tipo de juego, idioma, nivel, contenido de la partida y puntaje | [Patrón]: Entity (DDD) + State (active → finished | cancelled) | [Principio]: SRP + sin estado en FastAPI (la partida vive aquí) | [Tecnología]: TypeORM + PostgreSQL

export type GameStatus = 'active' | 'finished' | 'cancelled';

// [Contenido de la partida]: lo que el agente y los evaluadores necesitan en cada turno (jsonb flexible por juego)
export interface GameSessionContent {
  target?: string | null; // Palabra a describir o adivinar
  forbidden?: string[];
  topic?: string | null;
  vocabulary: {
    entryId?: string;
    term: string;
    translation?: string;
    emoji?: string;
    category?: string; // quick_sort: grupo al que pertenece la palabra
  }[];
  role?: string | null;
  objectives?: { id: string; text: string; keywords: string[] }[];
  met?: string[]; // Objetivos de role-play cumplidos
  lines?: { text: string; answer?: string; gap?: string }[]; // Comprensión: frases de la partida
  conversationId?: string | null; // Memoria del agente en FastAPI
  fallback?: boolean; // Contenido en inglés porque el idioma aún no tiene banco propio
}

@Entity({ name: 'game_sessions' })
@Index(['userId', 'createdAt'])
export class GameSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 32, name: 'game_type' })
  gameType!: GameType;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  level!: string | null; // A1–C2

  @Column({ type: 'smallint', default: 1 })
  difficulty!: number; // 1 fácil · 2 media · 3 difícil

  @Column({ type: 'uuid', name: 'scenario_id', nullable: true })
  scenarioId!: string | null;

  @Column({ type: 'jsonb' })
  content!: GameSessionContent;

  @Column({ type: 'varchar', length: 12, default: 'active' })
  status!: GameStatus;

  @Column({ type: 'int', default: 0 })
  score!: number;

  @Column({ type: 'int', name: 'rounds_count', default: 0 })
  roundsCount!: number;

  @Column({ type: 'int', name: 'correct_count', default: 0 })
  correctCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'finished_at', nullable: true })
  finishedAt!: Date | null;
}
