import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity CurriculumSource]: catálogo de fuentes reutilizables (se registran una vez, los recursos se asocian por id) | [Patrón]: Entity (DDD) | [Principio]: SRP + DRY
// [Tecnología]: TypeORM + PostgreSQL

// [Slug reservado]: fuente especial para contenido elaborado en la plataforma
export const OWN_CONTENT_SOURCE_SLUG = 'contenido-propio';

@Entity({ name: 'curriculum_sources' })
export class CurriculumSource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  slug!: string; // Evita fuentes duplicadas con distinto formato de nombre

  // [Tipo]: libre y corto (p. ej. "libro", "web", "diccionario")
  @Column({ type: 'varchar', length: 40, nullable: true })
  type!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  author!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  publisher!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  url!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  license!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language!: string | null;

  // [Atribución registrada]: se reutiliza en cada recurso asociado
  @Column({ type: 'text' })
  attribution!: string;

  // [Contenido propio]: marca la fuente especial (manual/interna)
  @Column({ type: 'boolean', name: 'is_own_content', default: false })
  isOwnContent!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
