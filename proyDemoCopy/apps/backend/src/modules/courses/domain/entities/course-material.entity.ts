import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity CourseMaterial]: archivo del curso (video, PDF o imagen) — solo METADATOS; el binario vive en el almacenamiento de archivos | [Patrón]: Entity (DDD) + Metadata/Blob split | [Principio]: SRP
// [Tecnología]: TypeORM (decoradores → tabla course_materials; con DATABASE_SYNCHRONIZE=true se crea sola en desarrollo)

// `export enum` (TS): tipos de material admitidos (valor legible en BD y JSON)
export enum CourseMaterialKind {
  VIDEO = 'video',
  PDF = 'pdf',
  IMAGE = 'image', // Infografías, fichas, diagramas (PNG/JPG/WebP/GIF)
  AUDIO = 'audio', // [2026-10-23]: podcasts, dictados, listening (MP3/WAV/M4A/OGG)
  DOCUMENT = 'document', // [2026-10-23]: Word, Excel, PowerPoint, TXT/Markdown (se descargan)
  LINK = 'link', // [2026-10-23]: recurso externo por URL (YouTube, artículo…) → sin binario
}

@Entity({ name: 'course_materials' })
@Index(['courseId'])
export class CourseMaterial {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [FK suave]: uuid del curso (sin @ManyToOne → el agregado Course no carga sus archivos)
  @Column({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string; // Título visible ("Unidad 1 · Saludos")

  @Column({ type: 'enum', enum: CourseMaterialKind })
  kind!: CourseMaterialKind;

  // [Clave de almacenamiento]: nombre interno aleatorio (no el del usuario) → sin colisiones ni rutas manipuladas
  // [URL externa · 2026-10-23]: solo kind=link (storage_key queda vacío) | [Patrón]: Optional Attribute
  @Column({ type: 'varchar', length: 2000, nullable: true })
  url!: string | null;

  @Column({ type: 'varchar', length: 255, name: 'storage_key' })
  storageKey!: string;

  @Column({ type: 'varchar', length: 255, name: 'original_name' })
  originalName!: string;

  @Column({ type: 'varchar', length: 100, name: 'mime_type' })
  mimeType!: string;

  // `bigint` en Postgres llega como string en JS → se transforma a number (archivos < 9 PB) | [Principio]: Tipado seguro
  @Column({
    type: 'bigint',
    name: 'size_bytes',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  sizeBytes!: number;

  @Column({ type: 'int', default: 0 })
  position!: number; // Orden dentro del curso

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
