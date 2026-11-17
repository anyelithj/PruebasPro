import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
// [CertificateTemplate · 2026-11-09 · RF-32]: fila única (id = 1) con los textos del PDF que configura el ADMIN | misma tabla que la migración ExamAttemptsTemplate

@Entity({ name: 'certificate_template' })
export class CertificateTemplateRow {
  @PrimaryColumn({ type: 'smallint', default: 1 })
  id!: number;

  @Column({ type: 'text', default: 'AULA DE IDIOMAS' })
  institution!: string;

  @Column({ type: 'text', nullable: true, name: 'signer_name' })
  signerName!: string | null;

  @Column({ type: 'text', nullable: true, name: 'signer_title' })
  signerTitle!: string | null;

  @Column({ type: 'text', nullable: true, name: 'legal_text' })
  legalText!: string | null;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
