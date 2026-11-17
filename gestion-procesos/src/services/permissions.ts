// ═══════════════════════════════════════════════════════════════════════════════════════
// permissions.ts — ROLES y PERMISOS (control de acceso basado en roles, RBAC).
// Es la fuente única de verdad para la INTERFAZ (menús, botones, rutas). La seguridad REAL está en firestore.rules,
// que el servidor de Firebase aplica aunque alguien manipule el navegador.
// Arquitectura: capa de DOMINIO (funciones y datos puros).
// ═══════════════════════════════════════════════════════════════════════════════════════

import type { Role } from '../models'

// Tipo UNIÓN DE LITERALES: `Permission` solo puede valer UNO de estos textos exactos. Si escribes uno que no existe, TypeScript
// marca error al compilar (seguridad de tipos). El formato «recurso:acción» facilita agrupar.
export type Permission =
  | 'process:create' // crear procesos
  | 'process:edit' // editar procesos
  | 'process:delete' // eliminar procesos
  | 'task:create'
  | 'task:edit'
  | 'task:delete'
  | 'workflow:view' // ver los flujos y sus estados (todos los roles)
  | 'workflow:manage' // crear/editar/eliminar flujos
  | 'automation:manage'
  | 'users:manage' // CRUD de usuarios y roles
  | 'dashboard:view'
  | 'report:view'
  | 'history:view'
  | 'file:upload'
  | 'file:delete'
  | 'chat:write'
  | 'ai:use'

// Lista de TODOS los permisos (el administrador los tiene todos). `Permission[]`: arreglo de ese tipo.
export const ALL_PERMISSIONS: Permission[] = [
  'process:create',
  'process:edit',
  'process:delete',
  'task:create',
  'task:edit',
  'task:delete',
  'workflow:view',
  'workflow:manage',
  'automation:manage',
  'users:manage',
  'dashboard:view',
  'report:view',
  'history:view',
  'file:upload',
  'file:delete',
  'chat:write',
  'ai:use',
]

// `Record<Permission, string>`: objeto que DEBE tener una entrada por cada permiso (si falta una, no compila).
export const PERMISSION_LABEL: Record<Permission, string> = {
  'process:create': 'Crear procesos',
  'process:edit': 'Editar procesos',
  'process:delete': 'Eliminar procesos',
  'task:create': 'Crear tareas',
  'task:edit': 'Editar tareas',
  'task:delete': 'Eliminar tareas',
  'workflow:view': 'Ver workflows',
  'workflow:manage': 'Gestionar workflows',
  'automation:manage': 'Gestionar automatizaciones',
  'users:manage': 'Gestionar usuarios',
  'dashboard:view': 'Ver indicadores',
  'report:view': 'Ver reportes',
  'history:view': 'Ver historial global',
  'file:upload': 'Subir archivos',
  'file:delete': 'Eliminar archivos',
  'chat:write': 'Escribir en el chat',
  'ai:use': 'Usar el asistente IA',
}

/** Matriz de roles → permisos. Es la fuente única para la interfaz; las reglas de Firestore refuerzan lo mismo en el servidor. */
// `Record<Role, Permission[]>`: cada rol (admin, manager, member, viewer) tiene su lista de permisos.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Administrador: todo.
  admin: ALL_PERMISSIONS,
  // Gestor: todo MENOS gestionar usuarios (`!==` = «distinto de», estricto).
  manager: ALL_PERMISSIONS.filter((p) => p !== 'users:manage'),
  // Miembro: crea y edita, pero NO elimina procesos/tareas ni gestiona usuarios.
  member: [
    'process:create',
    'process:edit',
    'task:create',
    'task:edit',
    'dashboard:view',
    'report:view',
    'history:view',
    'workflow:view',
    'file:upload',
    'chat:write',
    'ai:use',
  ],
  // Observador: solo lectura de indicadores y reportes, y asistente.
  viewer: ['dashboard:view', 'report:view', 'history:view', 'workflow:view', 'ai:use'],
}

// ¿Este rol tiene este permiso? `Role | undefined | null`: puede no haber rol (sin sesión).
// `!!role`: doble negación → convierte el valor a booleano (false si es undefined/null).
// `&&`: «y» lógico: solo si hay rol se consulta la matriz. `includes`: ¿está el permiso en la lista del rol?
export const can = (role: Role | undefined | null, permission: Permission): boolean =>
  !!role && ROLE_PERMISSIONS[role].includes(permission)
