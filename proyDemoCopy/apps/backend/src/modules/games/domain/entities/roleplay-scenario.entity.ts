import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity RolePlayScenario · Sprint 8.5 · RF-101]: escenario de role-play con papel del agente, objetivos y vocabulario clave | [Patrón]: Entity (DDD) + Soft Delete (archivedAt) | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL

export interface ScenarioObjective {
  id: string;
  text: string; // Lo que el usuario debe lograr (en español)
  keywords: string[]; // Palabras clave que lo cumplen (las detecta el motor de FastAPI sin LLM)
}

@Entity({ name: 'roleplay_scenarios' })
@Index(['language', 'level'])
export class RolePlayScenario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug!: string;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 2 })
  level!: string; // A1–C2

  @Column({ type: 'varchar', length: 16, default: '💬' })
  emoji!: string;

  @Column({ type: 'varchar', length: 120 })
  role!: string; // Papel del agente (en el idioma del escenario)

  @Column({ type: 'text', default: '' })
  opening!: string; // Primera frase del agente

  @Column({ type: 'jsonb' })
  objectives!: ScenarioObjective[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  vocabulary!: string[];

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy!: string | null; // null = escenario semilla del sistema

  @Column({ type: 'timestamptz', name: 'archived_at', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
