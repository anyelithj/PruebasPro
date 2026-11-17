import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity Certificate · Sprints 2.7/7.8]: certificado de un curso completado — código público, hash SHA-256 del PDF y hash de la transacción de anclaje en Sepolia | [Patrón]: Entity (DDD) + State (issued → revoked) + Snapshot (nombre y curso del momento) | [Principio]: SRP + DRY (un solo dueño: tabla + PDF + anclaje) | [Tecnología]: TypeORM
// [Privacidad]: la verificación pública solo expone código, nombre, curso, fecha y hashes (nunca email ni ids internos)

export type CertificateStatus = 'issued' | 'revoked';

@Entity({ name: 'certificates' })
@Index(['userId', 'courseId'], { unique: true }) // Un certificado por usuario y curso (emitir dos veces devuelve el mismo)
@Index('UQ_certificates_user_level', ['userId', 'quizId'], {
  unique: true,
  where: '"course_id" IS NULL',
}) // Uno por usuario y examen de nivel
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  // [2026-11-06]: null = certificado de NIVEL (examen de nivel sin curso) → lo identifica `quizId`
  @Column({ type: 'uuid', name: 'course_id', nullable: true })
  courseId!: string | null;

  // [2026-11-06 · Exámenes]: examen aprobado que lo otorgó (final de curso o de nivel) · null en certificados anteriores
  @Column({ type: 'uuid', name: 'quiz_id', nullable: true })
  quizId!: string | null;

  // [Nota]: % del examen aprobado (se imprime en el PDF) · null en certificados anteriores
  @Column({ type: 'smallint', name: 'exam_score', nullable: true })
  examScore!: number | null;

  // [Código público]: AULA-XXXX-XXXX (alfabeto sin 0/O/1/I para dictarlo sin errores) · va impreso y en el QR
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 160, name: 'recipient_name' })
  recipientName!: string;

  // [Caso E · 2026-11-13]: URL pública que codifica el QR (https://<DOMINIO>/certificados/verificar/<código>) — se fija al emitir y no cambia
  // aunque cambie el dominio configurado | null = certificados anteriores (su QR apunta a /verificar/<código>, que redirige)
  @Column({ type: 'varchar', length: 300, name: 'verify_url', nullable: true })
  verifyUrl!: string | null;

  @Column({ type: 'varchar', length: 200, name: 'course_title' })
  courseTitle!: string;

  // [Banda MCER]: A1–C2 del curso al emitir (null = curso sin nivel MCER) → color del diploma
  @Column({ type: 'varchar', length: 2, name: 'cefr_level', nullable: true })
  cefrLevel!: string | null;

  // [Huella del PDF]: SHA-256 en hex del archivo exacto que se entregó (lo que se ancla en la cadena)
  @Column({ type: 'char', length: 64, name: 'pdf_sha256' })
  pdfSha256!: string;

  @Column({ type: 'varchar', length: 300, name: 'object_key' })
  objectKey!: string;

  @Column({ type: 'int', name: 'size_bytes' })
  sizeBytes!: number;

  // [Anclaje]: null hasta que el worker de Web3 envía la transacción (o si el anclaje no está configurado)
  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 66,
    name: 'anchor_tx_hash',
    nullable: true,
  })
  anchorTxHash!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'issued' })
  status!: CertificateStatus;

  @Column({ type: 'text', name: 'revoke_reason', nullable: true })
  revokeReason!: string | null;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  // [Gestión · 2026-11-09 · RF-32]: notas de auditoría del ADMIN (no van en el PDF) · motivo de una emisión manual o reemisión
  @Column({ type: 'text', name: 'admin_notes', nullable: true })
  adminNotes!: string | null;

  // [Solicitud de revocación · 2026-11-09]: el DOCENTE del curso la pide con su justificación; solo el ADMIN revoca
  @Column({ type: 'text', name: 'revoke_request_reason', nullable: true })
  revokeRequestReason!: string | null;

  @Column({ type: 'uuid', name: 'revoke_requested_by', nullable: true })
  revokeRequestedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'revoke_requested_at', nullable: true })
  revokeRequestedAt!: Date | null;

  @CreateDateColumn({ name: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date;
}
