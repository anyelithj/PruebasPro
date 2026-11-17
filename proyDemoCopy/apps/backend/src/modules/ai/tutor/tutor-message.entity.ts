import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity TutorMessage · 2026-10-28]: turno de una conversación del Tutor IA (editar/borrar mensaje) | [Patrón]: Entity (parte del agregado TutorConversation) | [Principio]: SRP | [Tecnología]: TypeORM + PostgreSQL
// [Orden]: `seq` (entero creciente por conversación) y no la fecha → al editar se truncan los posteriores con `seq > n` sin ambigüedad

export type TutorRole = 'user' | 'assistant';

@Entity({ name: 'tutor_messages' })
@Index(['conversationId', 'seq'], { unique: true })
export class TutorMessage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [FK]: ON DELETE CASCADE en la migración → borrar la conversación borra sus mensajes
  @Column({ type: 'uuid', name: 'conversation_id' })
  conversationId!: string;

  @Column({ type: 'int' })
  seq!: number;

  @Column({ type: 'varchar', length: 10 })
  role!: TutorRole;

  @Column({ type: 'text' })
  content!: string;

  // [Editado]: null = nunca editado → la UI muestra «(editado)» solo cuando hace falta
  @Column({ type: 'timestamptz', name: 'edited_at', nullable: true })
  editedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
