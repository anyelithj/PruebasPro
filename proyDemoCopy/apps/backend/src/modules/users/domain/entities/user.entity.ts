import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../value-objects/role.vo';
// [Entity User]: agregado raíz del Bounded Context Users | [Patrón]: Aggregate Root (DDD) + Active Record (TypeORM) | [Principio]: SRP | [Paradigma]: POO

// [Nota arquitectónica]: idealmente Domain no conoce TypeORM (Hexagonal puro).
// Trade-off pragmático: usamos decorators TypeORM aquí para reducir mapper boilerplate.
// Si crece complejidad, migrar a Plain Domain + Mapper en infrastructure.

@Entity({ name: 'users' })
// [Índice único email]: garantiza unicidad a nivel DB (race-condition safe)
@Index(['email'], { unique: true })
export class User {
  // [PK UUID]: opaca, no enumerable (vs serial)
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // [Email]: store normalizado (lowercase) — VO se encarga de normalización antes de persistir
  @Column({ type: 'varchar', length: 320, unique: true })
  email!: string;

  // [Password hash]: nunca el plano, ya bcrypt+salt
  @Column({ type: 'varchar', length: 255, name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 80, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 80, name: 'last_name' })
  lastName!: string;

  // [Role enum string]: legibilidad en DB sin acoplar a orden numérico
  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role!: Role;

  // [Sección/grupo escolar]: agrupa estudiantes (ej. "A", "11-1", "2024-2"). Nullable: no todos los roles la tienen | [Patrón]: Optional Attribute
  @Index()
  @Column({ type: 'varchar', length: 40, nullable: true })
  section?: string | null;

  // [Preferencias del perfil · 2026-10-23]: antes vivían en localStorage (no viajaban entre dispositivos y el <select> se reseteaba al enviar el form) | [Principio]: SSOT en BD
  @Column({ type: 'varchar', length: 300, nullable: true })
  bio?: string | null;

  // [Teléfono · 2026-10-24]: opcional, formato internacional libre (+57 300 123 4567) | lo valida el DTO
  @Column({ type: 'varchar', length: 30, nullable: true })
  phone?: string | null;

  // [Zona horaria IANA]: ej. "America/Bogota"
  @Column({ type: 'varchar', length: 64, nullable: true })
  timezone?: string | null;

  // [Idioma preferido]: ISO 639-1 (es/en/pt) | si coincide con un idioma de la UI, el frontend también lo aplica a la interfaz
  @Column({ type: 'varchar', length: 5, nullable: true, name: 'preferred_language' })
  preferredLanguage?: string | null;

  // [Activo]: soft-disable sin borrar (logout forzado, baneo, etc.)
  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive!: boolean;

  // [Verificación email]: para flujo email verification (Sprint posterior)
  @Column({ type: 'boolean', default: false, name: 'is_email_verified' })
  isEmailVerified!: boolean;

  // [Timestamps auditables]: TypeORM los gestiona automáticamente
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
