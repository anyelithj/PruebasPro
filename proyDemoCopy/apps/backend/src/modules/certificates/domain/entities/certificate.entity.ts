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
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'course_id' })
  courseId!: string;

  // [Código público]: AULA-XXXX-XXXX (alfabeto sin 0/O/1/I para dictarlo sin errores) · va impreso y en el QR
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  code!: string;

  @Column({ type: 'varchar', length: 160, name: 'recipient_name' })
  recipientName!: string;

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

  @CreateDateColumn({ name: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date;
}
