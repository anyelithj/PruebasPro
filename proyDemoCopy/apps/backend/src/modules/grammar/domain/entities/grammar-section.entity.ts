import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { SectionType } from '../section-type';
// [Entity GrammarSection · Sprint 10.9 · RF-133]: sección de la ficha — uso, fórmula, negativa, interrogativa, nota o errores comunes — con su texto en orden | [Patrón]: Entity (DDD) | [Principio]: SRP (los ejemplos viven en GrammarExample) | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'grammar_sections' })
@Index(['topicId', 'position'])
export class GrammarSection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'topic_id' })
  topicId!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'varchar', length: 16 })
  type!: SectionType;

  @Column({ type: 'varchar', length: 120, default: '' })
  title!: string; // Opcional: si falta, la UI usa el nombre del tipo en español

  @Column({ type: 'text', default: '' })
  body!: string; // Explicación en español o fórmula («Sujeto + verbo (+s/es) + complemento»)
}
