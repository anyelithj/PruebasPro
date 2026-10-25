import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { TopicLike } from '../../../../shared/application/topic-crud.service';
// [Entity DialogueTopic · Sprint 9.3 · RF-121]: tema de conversación (presentarse, hobbies, rutinas, familia, animales, comida, viajes y cultura) con objetivos y vocabulario clave por idioma | [Patrón]: Entity (DDD) + Soft Delete (archivedAt) | [Principio]: SRP + DRY (TopicCrudService) | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'dialogue_topics' })
export class DialogueTopic implements TopicLike {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug!: string; // Clave de la apertura determinista en FastAPI (topic_script.py)

  @Column({ type: 'varchar', length: 120 })
  title!: string; // En español (idioma de instrucción)

  @Column({ type: 'varchar', length: 16, default: '💬' })
  emoji!: string;

  @Column({ type: 'text', default: '' })
  description!: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  language!: string | null; // null = disponible en los siete idiomas

  @Column({ type: 'jsonb', default: () => "'[]'" })
  levels!: string[]; // Niveles recomendados (vacío = todos)

  @Column({ type: 'jsonb', default: () => "'[]'" })
  objectives!: string[]; // Lo que el usuario practica (en español)

  // [Vocabulario clave por idioma]: { en: ['name', 'from'], fr: [...] } — el agente lo usa y la UI marca las palabras usadas
  @Column({ type: 'jsonb', default: () => "'{}'" })
  vocabulary!: Record<string, string[]>;

  @Column({ type: 'text', nullable: true })
  opening!: string | null; // Apertura escrita por el docente (temas propios); los semilla usan la de FastAPI

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'timestamptz', name: 'archived_at', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
