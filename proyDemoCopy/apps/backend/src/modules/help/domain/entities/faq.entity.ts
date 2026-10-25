import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
// [Entity Faq · Sprint 7.10 · RF-94/97]: pregunta frecuente con categoría, rol, idioma, fecha de revisión y enlace al artículo del manual | [Patrón]: Entity (DDD) + State (published → archived, borrado lógico) | [Principio]: SRP + SSOT (la tabla manda; el índice del Agente Guía se reconstruye desde aquí) | [Tecnología]: TypeORM + PostgreSQL

// [Valores compartidos]: los mismos del manual (ALL = todos los roles) y los dos idiomas de la interfaz
export const HELP_ROLES = ['ALL', 'USER', 'TEACHER', 'ADMIN'] as const;
export type HelpRole = (typeof HELP_ROLES)[number];
export const HELP_LOCALES = ['es', 'en'] as const;
export type HelpLocale = (typeof HELP_LOCALES)[number];
export type FaqStatus = 'published' | 'archived';

@Entity({ name: 'faqs' })
@Index(['locale', 'status', 'category'])
export class Faq {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 300 })
  question!: string;

  @Column({ type: 'text' })
  answer!: string;

  @Column({ type: 'varchar', length: 40 })
  category!: string;

  @Column({ type: 'varchar', length: 8, default: 'ALL' })
  role!: HelpRole;

  @Column({ type: 'varchar', length: 2, default: 'es' })
  locale!: HelpLocale;

  // [Enlace]: slug del artículo del manual («estudiante», «administrador»…) | null = sin artículo
  @Column({ type: 'varchar', length: 80, name: 'manual_slug', nullable: true })
  manualSlug!: string | null;

  @Column({ type: 'varchar', length: 12, default: 'published' })
  status!: FaqStatus;

  // [Revisión]: se renueva en cada edición → la UI muestra «revisada el…»
  @Column({ type: 'timestamptz', name: 'reviewed_at', default: () => 'now()' })
  reviewedAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
