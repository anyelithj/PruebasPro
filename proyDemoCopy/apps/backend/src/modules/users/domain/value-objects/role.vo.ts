// [Value Object Role]: enumera los roles del sistema RBAC | [Patrón]: Value Object | [Principio]: SRP | [Paradigma]: POO + tipos algebraicos

// [Enum Role]: tipo cerrado y exhaustivo de roles | [Principio]: ISP — cada rol tiene capacidades específicas
export enum Role {
  // [Estudiante]: juega quizzes, ve historial, usa asistente IA
  USER = 'USER',
  // [Docente]: hereda USER + crea/edita/publica quizzes propios
  TEACHER = 'TEACHER',
  // [Administrador]: hereda TEACHER + gestiona usuarios y analytics
  ADMIN = 'ADMIN',
}

// [Jerarquía de roles]: ordenada de menor a mayor privilegio | [Patrón]: Policy
export const ROLE_HIERARCHY: Readonly<Record<Role, number>> = Object.freeze({
  [Role.USER]: 1,
  [Role.TEACHER]: 2,
  [Role.ADMIN]: 3,
});

// [Helper jerárquico]: comprueba si rol actual cumple privilegio mínimo | [Principio]: DRY
export function hasRolePrivilege(current: Role, required: Role): boolean {
  return ROLE_HIERARCHY[current] >= ROLE_HIERARCHY[required];
}
