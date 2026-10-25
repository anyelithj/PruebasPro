import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity ReportExport · Sprint 6.4]: una exportación solicitada (PDF o Excel) y su ciclo de vida asíncrono | [Patrón]: Entity (DDD) + State (status) | [Principio]: SRP | [Tecnología]: TypeORM

// `as const` (TS): catálogos cerrados → tipos literales sin enum de PostgreSQL (migración simple)
export const REPORT_FORMATS = ['pdf', 'xlsx', 'docx'] as const; // [2026-10-19]: + Word (varchar(8): sin migración)
export type ReportFormat = (typeof REPORT_FORMATS)[number];

// [Estados]: pending → processing → ready | failed (los transiciona el worker de Bull)
export type ReportStatus = 'pending' | 'processing' | 'ready' | 'failed';

@Entity({ name: 'report_exports' })
@Index(['userId', 'createdAt'])
export class ReportExport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [Dueño]: solo quien la pidió puede verla, descargarla o borrarla
  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', length: 8 })
  format!: ReportFormat;

  // [Periodo]: meses del filtro de la pantalla de reportes (null = todo el histórico)
  @Column({ type: 'int', name: 'period_months', nullable: true })
  periodMonths!: number | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: ReportStatus;

  // [Archivo generado]: clave del objeto bajo el prefijo «reports» del almacén (disco, MinIO o R2 · Sprint 6.7)
  @Column({ type: 'varchar', length: 300, name: 'object_key', nullable: true })
  objectKey!: string | null;

  @Column({ type: 'int', name: 'size_bytes', nullable: true })
  sizeBytes!: number | null;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;
}
