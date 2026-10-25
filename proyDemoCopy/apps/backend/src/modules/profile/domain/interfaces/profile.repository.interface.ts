import { EducationLevel, UserProfile } from '../entities/user-profile.entity';
// [Port IProfileRepository]: contrato Domain → Infrastructure | [Patrón]: Repository + Port (Hexagonal) | [Principio]: DIP + ISP

// [Token DI]: usado para inyectar la implementación sin acoplar a clase concreta
export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

// [Input upsert]: campos que el caller puede setear | [Principio]: ISP
export interface UpsertProfileInput {
  userId: string;
  fullName: string;
  dateOfBirth?: Date | null;
  educationLevel?: EducationLevel | null;
  productiveActivity?: string | null;
}

// [Repositorio de perfiles]: Application depende de este Port | [Principio]: DIP
export interface IProfileRepository {
  // [findByUserId]: devuelve null si no existe (vs lanzar)
  findByUserId(userId: string): Promise<UserProfile | null>;
  // [upsert]: crea o actualiza atómicamente | [Patrón]: Upsert
  upsert(input: UpsertProfileInput): Promise<UserProfile>;
  // [delete]: hard delete (cascada con User on delete)
  delete(userId: string): Promise<void>;
}
