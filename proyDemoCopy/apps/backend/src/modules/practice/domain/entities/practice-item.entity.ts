import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ItemType, Skill } from '../item-type';
// [Entity PracticeItem · Sprint 8.12 · RF-110 a RF-113]: ítem de práctica — tipo, habilidad, enunciado, opciones, respuestas aceptadas, explicación y consejo | [Patrón]: Entity (DDD) | [Principio]: SRP + mínimo privilegio (accepted/corrections nunca llegan al estudiante) | [Tecnología]: TypeORM + PostgreSQL
// [Contrato de `accepted`]: el mismo de FastAPI /grading/practice (ver evaluate_request.py): por hueco, órdenes completos, índices con error o respuestas modelo

@Entity({ name: 'practice_items' })
@Index(['activityId', 'position'])
export class PracticeItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'activity_id' })
  activityId!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'varchar', length: 20, name: 'item_type' })
  itemType!: ItemType;

  @Column({ type: 'varchar', length: 12 })
  skill!: Skill;

  @Column({ type: 'text' })
  prompt!: string; // Enunciado o texto (mark_errors: el texto con errores)

  // [Opciones visibles]: choices, fichas a ordenar, pares (izquierda → opciones de la derecha)…
  @Column({ type: 'jsonb', default: () => "'[]'" })
  options!: string[];

  @Column({ type: 'jsonb' })
  accepted!: string[][];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  corrections!: Record<string, string>; // mark_errors: índice de palabra → corrección

  @Column({ type: 'text', default: '' })
  explanation!: string;

  @Column({ type: 'text', default: '' })
  tip!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
