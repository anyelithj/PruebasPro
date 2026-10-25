import {
  hasRolePrivilege,
  Role,
} from '../../users/domain/value-objects/role.vo';
// [Actor]: quién ejecuta el comando/consulta; se construye desde el JWT en la capa de presentación | [Patrón]: Parameter Object | [Principio]: DIP (la aplicación no depende de Express/Request) | [Paradigma]: Funcional

// `export interface` (TS): datos mínimos necesarios para autorizar (ISP: no se pasa el request completo)
export interface CurriculumActor {
  id: string; // UUID del usuario (sub del JWT)
  role: Role; // Rol RBAC
}

// [Política]: docentes y admins gestionan contenido; estudiantes solo leen lo aprobado | función pura
export const canManageCurriculum = (actor: CurriculumActor): boolean =>
  hasRolePrivilege(actor.role, Role.TEACHER);

// [Política]: solo ADMIN aprueba/rechaza y declara "validado por especialista"
export const canApproveCurriculum = (actor: CurriculumActor): boolean =>
  hasRolePrivilege(actor.role, Role.ADMIN);
