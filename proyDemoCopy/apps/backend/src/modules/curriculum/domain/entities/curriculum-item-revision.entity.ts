import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity CurriculumItemRevision]: registro INMUTABLE de cada cambio (quién, cuándo, qué) → trazabilidad editorial | [Patrón]: Audit Log + Memento (snapshot) | [Principio]: SRP | [Paradigma]: POO
// [Tecnología]: TypeORM + PostgreSQL (jsonb). Solo se inserta, nunca se actualiza ni borra (append-only).

// `export enum` (TS): tipo de cambio registrado
export enum RevisionChangeType {
  CREATED = 'created', // Alta del recurso
  UPDATED = 'updated', // Cambio de contenido/metadatos (incrementa versión)
  STATUS_CHANGED = 'status_changed', // Transición editorial (draft → review_required → reviewed → approved…)
}

@Entity({ name: 'curriculum_item_revisions' })
@Index('ix_curriculum_revision_item', ['itemId', 'createdAt']) // Historial ordenado por ítem sin escaneo completo
export class CurriculumItemRevision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [FK lógica al ítem]: sin relación ORM para no cargar el historial al leer ítems (evita consultas redundantes)
  @Column({ type: 'uuid', name: 'item_id' })
  itemId!: string;

  // [Versión del ítem tras el cambio]
  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'enum', enum: RevisionChangeType, name: 'change_type' })
  changeType!: RevisionChangeType;

  // [Snapshot completo]: permite reconstruir o comparar cualquier versión anterior | [Patrón]: Memento
  @Column({ type: 'jsonb' })
  snapshot!: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'changed_by' })
  changedBy!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
