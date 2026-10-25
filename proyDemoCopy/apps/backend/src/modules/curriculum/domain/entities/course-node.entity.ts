import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Course } from '../../../courses/domain/entities/course.entity';
import { CefrLevel } from '../../../../shared/domain/cefr-level.vo';
import { LanguageSkill } from '../../../../shared/domain/language-skill.vo';
import { CurriculumItemKind } from '../value-objects/curriculum-item-kind.vo';
import { CourseNodeType } from '../value-objects/course-node-type.vo';
import { CurriculumItem } from './curriculum-item.entity';
// [Entidad CourseNode]: un nodo de la estructura del curso (nivel, módulo, unidad o lección) en UNA sola tabla con parent_id | [Patrón]: Composite + Adjacency List | [Principio]: DRY (4 niveles sin 4 tablas casi iguales) + SRP | [Tecnología]: TypeORM + PostgreSQL

// `@Entity` (TypeORM): mapea la clase a la tabla `course_nodes`
@Entity({ name: 'course_nodes' })
// `@Index` (TypeORM): leer el árbol de un curso en orden (curso → padre → posición) sin escanear la tabla
@Index('ix_course_node_tree', ['courseId', 'parentId', 'position'])
export class CourseNode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [Curso raíz]: FK a courses; al borrar el curso se borra su estructura (ON DELETE CASCADE)
  @Column({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  @ManyToOne(() => Course, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'course_id' })
  course?: Relation<Course>; // `Relation<>` (TypeORM): seguro con SWC

  // [Padre]: null solo en los nodos de tipo nivel (raíces) | `string | null` (TS): unión con null explícito
  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => CourseNode, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent?: Relation<CourseNode> | null;

  @Column({ type: 'enum', enum: CourseNodeType })
  type!: CourseNodeType;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  // [Orden entre hermanos]: 0, 1, 2… dentro del mismo padre
  @Column({ type: 'smallint', default: 0 })
  position!: number;

  // [Nivel MCER]: se copia en todos los nodos de la rama → una lección conoce su nivel sin recorrer el árbol | [Principio]: KISS
  @Column({ type: 'enum', enum: CefrLevel })
  level!: CefrLevel;

  // ───── Solo lecciones: qué contenido necesitan (sirve para reutilizar lo existente y detectar huecos) ─────
  @Column({ type: 'varchar', length: 160, nullable: true })
  topic!: string | null;

  @Column({ type: 'enum', enum: CurriculumItemKind, nullable: true })
  kind!: CurriculumItemKind | null;

  @Column({ type: 'enum', enum: LanguageSkill, nullable: true })
  skill!: LanguageSkill | null;

  // [Recursos de la lección]: `@ManyToMany` + `@JoinTable` (TypeORM) → tabla course_lesson_items; un recurso puede reutilizarse en varias lecciones | [Principio]: DRY
  @ManyToMany(() => CurriculumItem)
  @JoinTable({
    name: 'course_lesson_items',
    joinColumn: { name: 'lesson_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'item_id', referencedColumnName: 'id' },
  })
  items?: CurriculumItem[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
