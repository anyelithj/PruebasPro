import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// [GameDeck · Entidad · 2026-10-25]: actividad de JUEGO con material propio — un tipo de juego de vocabulario (flashcards, parejas, bingo…) + sus palabras
// Gestión → Actividades → Juegos → Crear: el docente elige el juego y genera (IA), importa (URL, PDF, Word) o escribe las palabras; la partida usa ESTE mazo (?mazo=id)
// [Patrón]: Data Mapper (TypeORM) + Soft Delete (archivedAt) | [Principio]: SRP | [Paradigma]: POO + Declarativo (decoradores)

// [DeckItem]: una palabra del mazo | `category` solo la usa «clasificación rápida»
export interface DeckItem {
  term: string;
  translation?: string;
  emoji?: string;
  image?: string; // [2026-11-03]: imagen (enlace https) alternativa al emoji
  category?: string;
  // [2026-11-11 · todos los juegos]: `term` = palabra (vocabulario), tarjeta secreta (tabú, 20 preguntas…), tema (debate, historia…), frase (escucha) u objetivo (role-play)
  words?: string; // Palabras prohibidas (tabú, palabra prohibida) o palabras clave (role-play), separadas por comas
  question?: string; // Pregunta-respuesta rápida: la pregunta que se escucha tras la frase
  answer?: string; // Pregunta-respuesta rápida: respuesta esperada (palabra clave)
}

@Entity({ name: 'game_decks' })
export class GameDeck {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'game_type', type: 'varchar', length: 40 })
  gameType!: string;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'varchar', length: 5 })
  language!: string;

  @Column({ type: 'varchar', length: 4, nullable: true })
  level!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  items!: DeckItem[];

  @Column({ type: 'varchar', length: 10, default: 'draft' })
  status!: 'draft' | 'published';

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
