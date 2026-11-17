import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
// [Entity TutorConversation · 2026-10-28]: conversación del alumno con el Tutor IA (lista lateral con renombrar y borrar) | [Patrón]: Entity + Aggregate Root (sus mensajes viven en tutor_messages) | [Principio]: SRP + mínimo privilegio (siempre se filtra por user_id) | [Tecnología]: TypeORM + PostgreSQL
// [Por qué en NestJS]: FastAPI guardaba la conversación EN MEMORIA (se perdía al reiniciar y no se podía editar) → ahora NestJS es el dueño y envía el historial a FastAPI (modo sin estado)

// [LanguageUsage]: % de palabras del alumno en el idioma meta vs meta del nivel MCER (lo calcula FastAPI · SSOT de la regla) | `interface` (TS): forma del jsonb
export interface LanguageUsage {
  language: string;
  level: string;
  ratio: number; // 0–1
  target: number; // 0–1 (A1 0.3 · A2 0.4 · B1 0.6 · B2 0.75 · C1 0.9 · C2 1)
  words: number;
  target_words: number;
  turns: number;
  announced: boolean;
  below: boolean;
}

export const TUTOR_TITLE_MAX = 120; // [SSOT]: longitud del título (columna, DTO y recorte automático)

@Entity({ name: 'tutor_conversations' })
@Index(['userId', 'updatedAt']) // «Mis conversaciones» ordenadas por la más reciente sin recorrer la tabla
export class TutorConversation {
  // `@PrimaryColumn` (no Generated): el id se crea en el caso de uso (`randomUUID`) → viaja a FastAPI antes de guardar
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: TUTOR_TITLE_MAX })
  title!: string;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 2 })
  level!: string;

  // `jsonb` (PostgreSQL): instantánea del último cálculo → la lista y la recarga muestran el indicador sin llamar a FastAPI
  @Column({ type: 'jsonb', name: 'language_usage', nullable: true })
  languageUsage!: LanguageUsage | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
