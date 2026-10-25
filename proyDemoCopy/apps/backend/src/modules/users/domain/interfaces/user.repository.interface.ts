import { User } from '../entities/user.entity';
import { Role } from '../value-objects/role.vo';
// [Port del repositorio User]: contrato del Domain hacia Infrastructure | [Patrón]: Repository + Port (Hexagonal) | [Principio]: DIP + ISP | [Paradigma]: POO

// [Token DI]: usado para inyectar la implementación sin acoplar a clase concreta
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

// [Input creación]: campos necesarios para construir un User válido
export interface CreateUserInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role?: Role;
  section?: string | null;
  phone?: string | null; // [2026-10-24]
}

// [Opciones de listado]: filtros y paginación | [Principio]: ISP
export interface ListUsersOptions {
  page?: number;
  limit?: number;
  role?: Role;
  search?: string;
  // [Filtro por sección]: agrupación escolar | [Principio]: ISP
  section?: string;
}

export interface PaginatedUsers {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

// [Interfaz Repository]: capa Application depende de este Port, no de TypeORM | [Principio]: DIP
export interface IUserRepository {
  // [Find by id]: null si no existe (vs lanzar — caller decide qué hacer)
  findById(id: string): Promise<User | null>;
  // [Find by email]: usado en login y para verificar unicidad en registro
  findByEmail(email: string): Promise<User | null>;
  // [Create]: persiste y devuelve la entidad con id generado
  create(input: CreateUserInput): Promise<User>;
  // [Update parcial]: actualiza solo campos provistos
  update(id: string, partial: Partial<User>): Promise<User>;
  // [Soft disable]: cambia isActive=false (no borra)
  deactivate(id: string): Promise<void>;
  // [Reactivate]: contrario de deactivate — cambia isActive=true
  reactivate(id: string): Promise<void>;
  // [List paginado]: usado por ADMIN para gestión | [Principio]: ISP
  listAll(options: ListUsersOptions): Promise<PaginatedUsers>;
  // [Conteos agregados]: usado por reportes admin | [Principio]: SRP
  countByRole(): Promise<Record<string, number>>;
  // [Secciones existentes]: valores distintos no nulos para poblar filtros | [Principio]: SRP
  listSections(): Promise<string[]>;
}
