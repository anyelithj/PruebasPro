import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Language } from '../../../../shared/domain/language.vo';
// [Entidad PronunciationAudio · Sprint 4.7]: registro de cada audio generado (texto, idioma, variante, voz) y dónde está en el almacén de objetos | [Patrón]: Cache-Aside (índice de la caché) + Audit Record | [Principio]: Trazabilidad (qué motor y voz produjeron el audio) | [Tecnología]: TypeORM + PostgreSQL

@Entity({ name: 'pronunciation_audio' })
export class PronunciationAudio {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [Clave de caché]: sha256(texto normalizado | idioma | variante | motor) → `unique` impide guardar dos veces el mismo audio
  @Column({ type: 'char', length: 64, name: 'cache_key', unique: true })
  cacheKey!: string;

  @Column({ type: 'varchar', length: 300 })
  text!: string;

  @Column({ type: 'enum', enum: Language })
  language!: Language;

  @Column({ type: 'varchar', length: 20 })
  variant!: string; // BCP-47 (en-GB, pt-BR…)

  @Column({ type: 'varchar', length: 40 })
  voice!: string; // Voz del motor (p. ej. en-gb de espeak-ng)

  @Column({ type: 'varchar', length: 40 })
  engine!: string; // Motor (p. ej. espeak-ng)

  @Column({ type: 'varchar', length: 200, name: 'object_key' })
  objectKey!: string; // Ruta del objeto bajo el prefijo «pronunciation-audio» (disco, MinIO o R2)

  @Column({ type: 'int', name: 'size_bytes' })
  sizeBytes!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
