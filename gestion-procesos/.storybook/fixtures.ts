import type { Process, Task, UserProfile, Workflow } from '../src/models'

/** Datos de ejemplo solo para ilustrar los componentes en la documentación. */
export const exampleUsers: (UserProfile & { id: string })[] = [
  {
    id: 'u1',
    uid: 'u1',
    email: 'ana@ejemplo.co',
    displayName: 'Ana Gómez',
    photoURL: null,
    role: 'admin',
    createdAt: 0,
    active: true,
    position: 'Coordinadora',
    settings: { chatLang: 'es', notifyAssignments: true, notifyStatus: true, dueSoonDays: 2 },
  },
  {
    id: 'u2',
    uid: 'u2',
    email: 'luis@ejemplo.co',
    displayName: 'Luis Pérez',
    photoURL: null,
    role: 'member',
    createdAt: 0,
    active: true,
    position: 'Analista',
    settings: { chatLang: 'es', notifyAssignments: true, notifyStatus: true, dueSoonDays: 2 },
  },
]

export const exampleWorkflow: Workflow = {
  id: 'soporte',
  name: 'Soporte',
  states: ['Recibida', 'En análisis', 'Resuelta'],
}

export const exampleProcess: Process = {
  id: 'p1',
  title: 'Solicitud de acceso al sistema',
  description: 'Se necesita acceso al sistema de nómina para el nuevo analista.',
  kind: 'solicitud',
  priority: 'high',
  category: 'Tecnología',
  status: 'En revisión',
  workflowId: 'default',
  ownerId: 'u1',
  assigneeIds: ['u2'],
  startDate: '2026-10-01',
  dueDate: '2026-10-15',
  finishedAt: 0,
  aiSummary: '',
  createdAt: 0,
  updatedAt: 0,
}

export const exampleTask: Task = {
  id: 't1',
  processId: 'p1',
  title: 'Crear usuario en el sistema',
  description: 'Con el perfil de consulta.',
  priority: 'medium',
  status: 'doing',
  assigneeId: 'u2',
  dueDate: '2026-10-10',
  completedAt: 0,
  createdBy: 'u1',
  createdAt: 0,
  updatedAt: 0,
}
