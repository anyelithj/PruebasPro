import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
// [GameSetting · Entidad · 2026-10-24]: ajuste EDITABLE de un juego del catálogo (los 18 tipos siguen en código: GAME_TYPES)
// Sin fila = juego publicado con su nombre y descripción por defecto · con fila = título/descripción propios y estado
// [Patrón]: Override sobre un catálogo estático (Lookup Table + Data Mapper de TypeORM) | [Principio]: OCP (el catálogo no cambia) + SRP | [Paradigma]: POO + Declarativo (decoradores)

// `export type` (TS): estados de publicación · archived = «eliminado» (no se lista ni se puede jugar)
export type GameStatus = 'published' | 'draft' | 'archived';
export const GAME_STATUSES: readonly GameStatus[] = ['published', 'draft', 'archived'];

@Entity({ name: 'game_settings' })
export class GameSetting {
  @PrimaryColumn({ type: 'varchar', length: 40 }) // `@PrimaryColumn` (TypeORM): la clave es el tipo de juego (flashcards, taboo…)
  type!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  title!: string | null; // null → nombre por defecto del juego

  @Column({ type: 'varchar', length: 240, nullable: true })
  description!: string | null; // null → descripción por defecto

  @Column({ type: 'varchar', length: 10, default: 'published' })
  status!: GameStatus;

  @Column({ type: 'uuid', name: 'updated_by', nullable: true })
  updatedBy!: string | null; // Quién lo cambió (auditoría mínima)

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
