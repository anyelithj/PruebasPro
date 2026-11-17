// ═══════════════════════════════════════════════════════════════════════════════════════
// models/index.ts — MODELO DE DATOS en TypeScript (capa de DOMINIO). Debe coincidir con database/schema.json
// (una prueba automática lo verifica). Aquí SOLO hay tipos y datos puros: no depende de React, Redux ni Firebase.
// Vocabulario de TypeScript usado en este archivo:
//   type      → crea un nombre (alias) para un tipo. `A | B` = unión: el valor es A o B. `A & B` = intersección: tiene lo de A y lo de B.
//   interface → describe la forma de un objeto (qué campos tiene y de qué tipo). `extends` = hereda los campos de otra interface.
//   export    → permite importar la declaración desde otros archivos.   `?` tras un nombre = campo opcional.
//   Record<K, V> → objeto con una clave por cada K (obligatoria) y valores de tipo V.   Partial<T> → todos los campos de T opcionales.
//   string[]  → arreglo de textos.   number → número.   boolean → verdadero/falso.   null → ausencia deliberada de valor.
// Los comentarios de cada declaración siguen el mismo patrón; las que se repiten (Priority, Task, Channel…) llevan una nota breve.
// ═══════════════════════════════════════════════════════════════════════════════════════

// Roles del sistema (RBAC). Tipo UNIÓN de textos literales: cualquier otro texto da error de compilación.
export type Role = 'admin' | 'manager' | 'member' | 'viewer'
// Lista de roles en forma de arreglo (sirve para recorrerlos, p. ej. en un <select>). `: Role[]` verifica cada elemento.
export const ROLES: Role[] = ['admin', 'manager', 'member', 'viewer']
// Nombre legible de cada rol. `Record<Role, string>` obliga a tener una entrada por cada rol.
export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  manager: 'Gestor',
  member: 'Miembro',
  viewer: 'Observador',
}

// Datos mínimos del usuario que da Firebase Authentication. `string | null`: puede venir sin nombre o sin foto.
export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
}
// Idiomas soportados para la traducción del chat.
export type Lang = 'es' | 'en'

// Configuración personal (se edita en «Mi perfil»).
export interface UserSettings {
  /** Idioma de destino por defecto al traducir mensajes del chat. */
  chatLang: Lang
  notifyAssignments: boolean
  notifyStatus: boolean
  /** Días de anticipación para avisar de vencimientos próximos. */
  dueSoonDays: number
}
// Valores por defecto. `const`: no se reasigna. Se usa cuando el perfil aún no tiene configuración.
export const DEFAULT_SETTINGS: UserSettings = {
  chatLang: 'es',
  notifyAssignments: true,
  notifyStatus: true,
  dueSoonDays: 2,
}

// Perfil guardado en la colección `users`. `extends AuthUser`: incluye uid, email, displayName y photoURL, y agrega los propios.
export interface UserProfile extends AuthUser {
  role: Role
  createdAt: number
  active: boolean
  position: string
  settings: UserSettings
}

/** Los documentos creados por versiones anteriores pueden no tener todos los campos: se completan aquí. */
// Función pura que completa los campos que falten (documentos creados por versiones antiguas). `Partial<UserProfile> & AuthUser`: perfil incompleto pero con los datos de Authentication.
// `...raw` (spread) copia todo; luego cada línea aplica un valor por defecto con `??` (usa el de la derecha si el de la izquierda es null/undefined).
export const withProfileDefaults = (raw: Partial<UserProfile> & AuthUser): UserProfile => ({
  ...raw,
  role: raw.role ?? 'member',
  createdAt: raw.createdAt ?? Date.now(),
  active: raw.active ?? true,
  position: raw.position ?? '',
  settings: { ...DEFAULT_SETTINGS, ...raw.settings },
})

// Prioridad: unión de literales; PRIORITIES, PRIORITY_LABEL y PRIORITY_VARIANT (color de Bootstrap) siguen el mismo patrón que los roles.
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent']
export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}
export const PRIORITY_VARIANT: Record<Priority, string> = {
  low: 'secondary',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
}

// Flujo de trabajo: lista ordenada de estados por los que pasa un proceso (el último es el estado final).
export interface Workflow {
  id: string
  name: string
  /** Estados ordenados; el último es el estado final. */
  states: string[]
  description?: string
  /** Días en un mismo estado a partir de los cuales un proceso se considera estancado. */
  stuckDays?: number
  createdBy?: string
}

// Un registro puede ser un «proceso» o una «solicitud».
export type ProcessKind = 'proceso' | 'solicitud'
// Proceso o solicitud. Las fechas con hora son números (milisegundos, Date.now()); las de calendario, texto AAAA-MM-DD.
export interface Process {
  id: string
  title: string
  description: string
  kind: ProcessKind
  priority: Priority
  category: string
  status: string
  workflowId: string
  ownerId: string
  assigneeIds: string[]
  /** Formato AAAA-MM-DD o cadena vacía. */
  startDate: string
  dueDate: string
  /** Marca de tiempo en que llegó al estado final (0 si sigue abierto). */
  finishedAt: number
  /** Resumen generado por el asistente de IA. */
  aiSummary: string
  createdAt: number
  updatedAt: number
}
// Igual que withProfileDefaults: valores por defecto primero y `...p` al final para que lo que llegue de Firestore los sobrescriba.
export const withProcessDefaults = (p: Partial<Process> & { id: string }): Process => ({
  title: '',
  description: '',
  kind: 'proceso',
  priority: 'medium',
  category: '',
  status: '',
  workflowId: 'default',
  ownerId: '',
  assigneeIds: [],
  startDate: '',
  dueDate: '',
  finishedAt: 0,
  aiSummary: '',
  createdAt: 0,
  updatedAt: 0,
  ...p,
})

// Estados fijos de una tarea (tablero Kanban de tareas).
export type TaskStatus = 'todo' | 'doing' | 'review' | 'done'
export const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'review', 'done']
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Por hacer',
  doing: 'En curso',
  review: 'En revisión',
  done: 'Hecha',
}
// Tarea. `processId` vacío = tarea suelta (sin proceso).
export interface Task {
  id: string
  processId: string
  title: string
  description: string
  priority: Priority
  status: TaskStatus
  assigneeId: string
  dueDate: string
  /** Marca de tiempo en que se completó (0 si sigue abierta). */
  completedAt: number
  createdBy: string
  createdAt: number
  updatedAt: number
}
export const withTaskDefaults = (t: Partial<Task> & { id: string }): Task => ({
  processId: '',
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  assigneeId: '',
  dueDate: '',
  completedAt: 0,
  createdBy: '',
  createdAt: 0,
  updatedAt: 0,
  ...t,
})

// Aviso guardado para una persona (las alertas de vencimiento NO se guardan: se calculan).
export interface AppNotification {
  id: string
  userId: string
  message: string
  link: string
  read: boolean
  createdAt: number
}

// Automatizaciones: disparadores (cuándo) y acciones (qué hacer). Ver services/automation.ts.
export type TriggerType = 'task_created' | 'task_status' | 'process_created' | 'process_status'
export type ActionType = 'notify' | 'assign' | 'set_priority' | 'create_task'
export interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  trigger: { type: TriggerType; value: string }
  action: { type: ActionType; value: string }
  createdBy: string
}

// Chat: canal (puede ser el chat de atención de un proceso) y mensaje.
export interface Channel {
  id: string
  name: string
  /** Si el canal atiende una solicitud concreta. */
  processId?: string
  createdBy: string
  createdAt: number
}
export interface ChatMessage {
  id: string
  text: string
  uid: string
  displayName: string
  createdAt: number
}

// Historial de cambios (solo se agrega; las reglas de Firestore no permiten editarlo ni borrarlo).
export type HistoryEntity = 'process' | 'task' | 'user' | 'workflow' | 'file'
export type HistoryAction = 'create' | 'update' | 'status' | 'assign' | 'delete' | 'ai' | 'automation' | 'file'
export const HISTORY_ACTION_LABEL: Record<HistoryAction, string> = {
  create: 'Creación',
  update: 'Edición',
  status: 'Cambio de estado',
  assign: 'Asignación',
  delete: 'Eliminación',
  ai: 'Asistente IA',
  automation: 'Automatización',
  file: 'Archivo',
}
export interface HistoryEntry {
  id: string
  entityType: HistoryEntity
  entityId: string
  entityTitle: string
  action: HistoryAction
  summary: string
  userId: string
  userName: string
  createdAt: number
}

// Metadatos de un archivo adjunto (el contenido va en `fileBlobs` o en Cloud Storage).
export interface FileRecord {
  id: string
  entityType: 'process' | 'task'
  entityId: string
  entityTitle: string
  name: string
  size: number
  mime: string
  backend: 'firestore' | 'storage'
  /** Ruta en Cloud Storage (solo backend «storage»). */
  path: string
  uploadedBy: string
  uploaderName: string
  createdAt: number
}
