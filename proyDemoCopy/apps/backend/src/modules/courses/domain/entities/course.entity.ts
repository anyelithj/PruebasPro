import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  CourseCategory,
  CourseGroup,
} from '../value-objects/course-category.vo';
// [Entity Course]: agregado raíz del Bounded Context Courses | [Patrón]: Aggregate Root (DDD) + Active Record (TypeORM) | [Principio]: SRP

@Entity({ name: 'courses' })
@Index(['category'])
@Index(['group'])
@Index(['isPublished'])
@Index(['isProBono'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [Título]: hasta 200 caracteres para acomodar Diplomados largos como "DIPLOMADO IX: SALUD, NUTRICIÓN…"
  @Column({ type: 'varchar', length: 200 })
  title!: string;

  // [Slug URL-friendly]: indexado único para detail page por slug opcional
  @Column({ type: 'varchar', length: 220, unique: true })
  slug!: string;

  @Column({ type: 'text' })
  shortDescription!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // [Categoría fina]: 12 diplomados + master + facultades + competencias + dimensiones + STEM, etc.
  @Column({ type: 'enum', enum: CourseCategory })
  category!: CourseCategory;

  // [Grupo agregado]: deriva de la categoría — denormalizado para filtros rápidos
  @Column({ type: 'enum', enum: CourseGroup, name: 'category_group' })
  group!: CourseGroup;

  @Column({ type: 'varchar', length: 120 })
  instructor!: string;

  @Column({
    type: 'varchar',
    length: 160,
    nullable: true,
    name: 'instructor_title',
  })
  instructorTitle!: string | null;

  // [Color hex]: usado por la UI para gradients y badges
  @Column({ type: 'varchar', length: 9, default: '#1B7EC8' })
  color!: string;

  @Column({ type: 'varchar', length: 8, default: '🎓' })
  icon!: string;

  // [Etiquetas opcionales]: NFT, VR, EEG, Nuevo, Gratis, IA, etc. — array nativo PostgreSQL
  @Column({ type: 'simple-array', default: '' })
  tags!: string[];

  // [Eje formativo 1..5]: enlaza con los 5 Ejes del programa | [SSOT]: alinear con frontend EJES
  @Column({ type: 'smallint', default: 1 })
  eje!: number;

  // [Laboratorio asociado]: opcional, p.ej. "Focus Lab 1"
  @Column({ type: 'varchar', length: 60, nullable: true })
  lab!: string | null;

  // [Precio]: numeric para evitar redondeos float
  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  price!: number;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'original_price',
  })
  originalPrice!: number | null;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  // [Duración estimada total en horas]
  @Column({ type: 'smallint', default: 0, name: 'duration_hours' })
  durationHours!: number;

  // [Nivel]: 'Básico' | 'Intermedio' | 'Avanzado' | 'Todos los niveles'
  @Column({ type: 'varchar', length: 30, default: 'Intermedio' })
  level!: string;

  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating!: number;

  @Column({ type: 'int', default: 0, name: 'students_count' })
  studentsCount!: number;

  // [Modalidad]: 'Online' | 'Presencial' | 'Híbrida'
  @Column({ type: 'varchar', length: 20, default: 'Online' })
  modality!: string;

  @Column({ type: 'boolean', default: false, name: 'is_pro_bono' })
  isProBono!: boolean;

  @Column({ type: 'boolean', default: true, name: 'is_published' })
  isPublished!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
