import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { TurnFeedback } from '../interfaces/sentence-corrector.interface';
// [Entity DialogueTurn · Sprint 9.3 · RF-123/RF-124]: un turno de un diálogo guionado (hablante A o B) o de una conversación con el avatar (user o avatar) con texto, IPA, traducción y tiempos | [Patrón]: Entity (DDD) + Snapshot (IPA y traducción guardados) | [Principio]: SRP + DRY (una tabla para ambos usos) + verificación humana (la corrección manual prevalece) | [Tecnología]: TypeORM + PostgreSQL

export type Speaker = 'A' | 'B' | 'user' | 'avatar';

@Entity({ name: 'dialogue_turns' })
@Index(['dialogueId', 'position'])
@Index(['sessionId', 'position'])
export class DialogueTurn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'dialogue_id', nullable: true })
  dialogueId!: string | null; // Diálogo de la biblioteca…

  @Column({ type: 'uuid', name: 'session_id', nullable: true })
  sessionId!: string | null; // …o conversación con el avatar (uno de los dos)

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'varchar', length: 6 })
  speaker!: Speaker;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'text', default: '' })
  ipa!: string;

  @Column({ type: 'text', name: 'ipa_us', nullable: true })
  ipaUs!: string | null;

  @Column({ type: 'text', nullable: true })
  translation!: string | null;

  @Column({ type: 'real', name: 'start_s', nullable: true })
  startS!: number | null;

  @Column({ type: 'real', name: 'end_s', nullable: true })
  endS!: number | null;

  @Column({ type: 'text', nullable: true })
  correction!: string | null; // [Histórico]: corrección en texto de turnos anteriores al 2026-11-13 (los nuevos usan `feedback`)

  // [2026-11-13 · Anexo A]: corrección pedagógica ÚNICA del turno del usuario (frase corregida, veredicto, errores, traducción,
  // puntuación y trazabilidad: modelo + versión del prompt) | `jsonb` (PostgreSQL): un documento sin tablas extra · null = sin corrección
  @Column({ type: 'jsonb', nullable: true })
  feedback!: TurnFeedback | null;

  @Column({ type: 'boolean', default: false })
  reviewed!: boolean;

  // [2026-10-20]: grabación de voz del turno del usuario (conversación con el avatar) en el almacén «dialogues» | null = sin grabación
  @Column({ type: 'varchar', length: 300, name: 'audio_key', nullable: true })
  audioKey!: string | null;

  @Column({ type: 'varchar', length: 60, name: 'audio_mime', nullable: true })
  audioMime!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
