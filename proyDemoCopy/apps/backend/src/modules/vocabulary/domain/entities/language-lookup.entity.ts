import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
// [Entity LanguageLookup · Sprint 8.2 · RF-106/RF-107/RF-136]: caché de traducciones e IPA por huella (texto, idioma, destino y contexto) | [Patrón]: Cache-Aside (tabla) + Entity | [Principio]: determinístico primero (la segunda consulta no llama a FastAPI ni al LLM) | [Tecnología]: TypeORM + PostgreSQL

export type LookupKind = 'term' | 'word';

@Entity({ name: 'language_lookups' })
export class LanguageLookup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [Huella]: SHA-256 hex de kind|idioma|destino|texto|contexto → clave única de la caché
  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  fingerprint!: string;

  @Column({ type: 'varchar', length: 8 })
  kind!: LookupKind;

  @Column({ type: 'varchar', length: 2 })
  language!: string;

  @Column({ type: 'varchar', length: 500 })
  text!: string;

  @Column({ type: 'text', nullable: true })
  context!: string | null; // Frase donde aparece la palabra (kind = word)

  // `jsonb`: respuesta de FastAPI tal cual (traducción, alternativas, IPA UK/US, ejemplos)
  @Column({ type: 'jsonb' })
  result!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 60 })
  engine!: string; // Fonetizador y versión (p. ej. «espeak-ng 1.52.0»)

  @Column({ type: 'int', default: 0 })
  hits!: number; // Veces que la caché evitó llamar a FastAPI

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
