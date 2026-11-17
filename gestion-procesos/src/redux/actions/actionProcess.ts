// ═══════════════════════════════════════════════════════════════════════════════════════
// actionProcess.ts — CASOS DE USO del CRUD de procesos (escriben en Firestore).
// Cada función es un THUNK: una función que, al ejecutarse, devuelve OTRA función `async (dispatch, getState) => {...}`.
// Redux Toolkit incluye redux-thunk, así que `dispatch(addProcess(datos))` ejecuta esa función interna con acceso al store.
// Es una función de orden superior (paradigma FUNCIONAL) y asíncrona (paradigma ASÍNCRONO: usa async/await).
// Después de escribir en Firestore NO se actualiza el store a mano: el oyente de useDataSync (Observer) recibe el cambio
// y lo copia al store → un único camino de datos (Flux, flujo unidireccional).
// ═══════════════════════════════════════════════════════════════════════════════════════

import { PRIORITY_LABEL, type Process } from '../../models'
// Servicios del dominio y de infraestructura que los thunks orquestan.
import { analyze, type AIResult } from '../../services/ai' // asistente local: categoría, prioridad, resumen
import { runAutomations } from '../../services/automation' // reglas «cuando pase X, haz Y»
import { create, patch, remove } from '../../services/firestoreService' // fachada de Firestore
import { diffFields, logHistory } from '../../services/history' // historial de cambios
import { DEFAULT_WORKFLOW, canTransition, isFinalState } from '../../services/workflow' // máquina de estados
import type { RootState, AppThunk } from '../store/store'
import { deleteFile } from './actionFile'
import { formatChange, getActor, userName } from './actionHelpers'
import { sendNotification } from './actionNotification'
import { deleteTask } from './actionTask'
import { processError, setProcesses } from '../reducers/processReducers'

// Re-exporta las acciones del slice para que otros archivos las importen desde un solo lugar.
export { processError, setProcesses }

// `Pick<Process, ...>`: tipo utilitario de TypeScript que toma SOLO algunos campos de `Process` (los que el formulario envía;
// id, ownerId y fechas los pone el sistema). Evita repetir la definición (DRY).
export type ProcessInput = Pick<
  Process,
  | 'title'
  | 'description'
  | 'kind'
  | 'priority'
  | 'category'
  | 'status'
  | 'workflowId'
  | 'assigneeIds'
  | 'startDate'
  | 'dueDate'
>

// Nombres legibles de los campos para el historial. `Partial<Record<keyof Process, string>>`: no hace falta etiquetar todos.
// `keyof Process`: tipo con todos los nombres de campo de Process.
const LABELS: Partial<Record<keyof Process, string>> = {
  title: 'Título',
  description: 'Descripción',
  kind: 'Tipo',
  priority: 'Prioridad',
  category: 'Categoría',
  assigneeIds: 'Responsables',
  startDate: 'Inicio',
  dueDate: 'Fecha límite',
}

// Busca el flujo de un proceso en el store; si no existe (o es «default») usa el flujo por defecto. `??`: valor alternativo si es null/undefined.
const findWorkflow = (state: RootState, id: string) => state.workflow.items.find((w) => w.id === id) ?? DEFAULT_WORKFLOW

// ───────────── CREATE ─────────────
// `AppThunk<Promise<string>>`: thunk que devuelve una Promesa con el id del proceso creado.
export const addProcess =
  (input: ProcessInput): AppThunk<Promise<string>> =>
  // Función interna: Redux Toolkit le inyecta `dispatch` (enviar acciones) y `getState` (leer el estado).
  async (dispatch, getState) => {
    const state = getState()
    // Quién realiza la acción (para el dueño del proceso y para el historial).
    const actor = getActor(state)
    const now = Date.now()
    // La IA local sugiere categoría y resumen a partir del título y la descripción.
    const ai = analyze(`${input.title}. ${input.description}`)
    // Datos completos del documento: lo que envió el formulario + lo que pone el sistema.
    const data = {
      ...input,
      // `||`: si la categoría viene vacía, usa la sugerida por la IA.
      category: input.category || ai.category,
      // Solo guarda resumen si hay descripción. `.trim()` quita espacios.
      aiSummary: input.description.trim() ? ai.summary : '',
      ownerId: actor.uid,
      finishedAt: 0,
      createdAt: now,
      updatedAt: now,
    }
    // Guarda en Firestore y espera el id generado.
    const id = await create('processes', data)
    // Deja constancia en el historial (HISTORIAL Y SEGUIMIENTO DE CAMBIOS).
    await logHistory(
      {
        entityType: 'process',
        entityId: id,
        entityTitle: input.title,
        action: 'create',
        summary: `Creó ${input.kind === 'solicitud' ? 'la solicitud' : 'el proceso'} en el estado «${input.status}»`,
      },
      actor,
    )
    // Avisa a cada responsable. `Promise.all` los envía en paralelo y espera a todos.
    await Promise.all(
      input.assigneeIds.map((uid) =>
        dispatch(sendNotification(uid, `Te asignaron: ${input.title}`, `/app/procesos/${id}`, 'assignments')),
      ),
    )
    // Dispara las automatizaciones configuradas para «proceso creado».
    await runAutomations({ type: 'process_created', process: { ...data, id } })
    return id
  }

// ───────────── UPDATE ─────────────
export const editProcess =
  // `Partial<ProcessInput>`: todos los campos opcionales (se envía solo lo que cambió).
  (id: string, input: Partial<ProcessInput>): AppThunk<Promise<void>> =>
    async (dispatch, getState) => {
      const state = getState()
      const actor = getActor(state)
      // Versión anterior (para comparar y registrar qué cambió).
      const before = state.process.items.find((p) => p.id === id)
      // `throw new Error(...)`: lanza un error que el formulario atrapa (useFormSubmit) y muestra al usuario.
      if (!before) throw new Error('Proceso no encontrado')
      // Lista legible de cambios: «Prioridad: Media → Alta».
      const changes = diffFields(before, input, LABELS, formatChange(state))
      // `Record<string, unknown>`: objeto con claves de texto y valores de cualquier tipo.
      const patchData: Record<string, unknown> = { ...input, updatedAt: Date.now() }
      // Si cambió la descripción, recalcula el resumen de la IA.
      if (input.description !== undefined && input.description !== before.description)
        patchData.aiSummary = input.description.trim()
          ? analyze(`${input.title ?? before.title}. ${input.description}`).summary
          : ''
      // Actualización parcial en Firestore (solo los campos indicados).
      await patch('processes', id, patchData)
      // Solo registra historial si realmente hubo cambios. `.length` 0 = falso.
      if (changes.length)
        await logHistory(
          {
            entityType: 'process',
            entityId: id,
            entityTitle: input.title ?? before.title,
            action: 'update',
            // `join(' · ')`: une los cambios en un solo texto.
            summary: changes.join(' · '),
          },
          actor,
        )
      // Responsables NUEVOS: están en la lista nueva pero no estaban en la anterior.
      const added = (input.assigneeIds ?? []).filter((u) => !before.assigneeIds.includes(u))
      await Promise.all(
        added.map((uid) =>
          dispatch(sendNotification(uid, `Te asignaron: ${before.title}`, `/app/procesos/${id}`, 'assignments')),
        ),
      )
    }

// ───────────── CAMBIO DE ESTADO dentro del workflow (State pattern) ─────────────
export const moveProcess =
  (process: Process, status: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const state = getState()
    const actor = getActor(state)
    const workflow = findWorkflow(state, process.workflowId)
    // Regla de dominio: solo se avanza o retrocede un estado a la vez.
    if (!canTransition(workflow, process.status, status))
      throw new Error('Solo puedes avanzar o retroceder un estado a la vez.')
    const now = Date.now()
    await patch('processes', process.id, {
      status,
      updatedAt: now,
      // Al llegar al estado final guarda la fecha de cierre (sirve para los indicadores); si retrocede, vuelve a 0.
      finishedAt: isFinalState(workflow, status) ? now : 0,
    })
    await logHistory(
      {
        entityType: 'process',
        entityId: process.id,
        entityTitle: process.title,
        action: 'status',
        summary: `Estado: ${process.status} → ${status}`,
      },
      actor,
    )
    // `new Set([...])`: conjunto sin repetidos (si el dueño también es responsable, se avisa una sola vez).
    const targets = [...new Set([process.ownerId, ...process.assigneeIds])]
    await Promise.all(
      targets.map((uid) =>
        dispatch(
          sendNotification(uid, `«${process.title}» pasó a «${status}»`, `/app/procesos/${process.id}`, 'status'),
        ),
      ),
    )
    await runAutomations({ type: 'process_status', process: { ...process, status }, to: status })
  }

// ───────────── IA: aplicar el análisis a una solicitud ─────────────
export const applyAnalysis =
  (process: Process, result: AIResult): AppThunk<Promise<void>> =>
  // `_dispatch`: parámetro que no se usa (el guion bajo lo indica).
  async (_dispatch, getState) => {
    const actor = getActor(getState())
    await patch('processes', process.id, {
      category: result.category,
      priority: result.priority,
      aiSummary: result.summary,
      updatedAt: Date.now(),
    })
    await logHistory(
      {
        entityType: 'process',
        entityId: process.id,
        entityTitle: process.title,
        action: 'ai',
        summary: `La IA aplicó categoría «${result.category}» y prioridad ${PRIORITY_LABEL[result.priority].toLowerCase()}`,
      },
      actor,
    )
  }

/** Clasifica y resume los procesos que aún no tienen categoría o resumen. Devuelve cuántos actualizó. */
export const classifyPending = (): AppThunk<Promise<number>> => async (_dispatch, getState) => {
  const state = getState()
  const actor = getActor(state)
  // Procesos sin categoría, o con descripción pero sin resumen.
  const pending = state.process.items.filter((p) => !p.category || (!p.aiSummary && p.description.trim()))
  // `async` dentro de `map`: cada proceso se procesa en paralelo.
  await Promise.all(
    pending.map(async (p) => {
      const r = analyze(`${p.title}. ${p.description}`)
      await patch('processes', p.id, {
        category: p.category || r.category,
        aiSummary: p.description.trim() ? r.summary : '',
        updatedAt: Date.now(),
      })
      await logHistory(
        {
          entityType: 'process',
          entityId: p.id,
          entityTitle: p.title,
          action: 'ai',
          summary: `La IA clasificó como «${p.category || r.category}»`,
        },
        actor,
      )
    }),
  )
  return pending.length
}

// ───────────── DELETE (en cascada) ─────────────
export const deleteProcess =
  (id: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const state = getState()
    const actor = getActor(state)
    const process = state.process.items.find((p) => p.id === id)
    // Si ya no existe, no hay nada que hacer.
    if (!process) return
    // Se eliminan también las tareas y archivos del proceso para no dejar datos huérfanos.
    await Promise.all(state.task.items.filter((t) => t.processId === id).map((t) => dispatch(deleteTask(t))))
    await Promise.all(
      state.file.items
        .filter((f) => f.entityType === 'process' && f.entityId === id)
        .map((f) => dispatch(deleteFile(f))),
    )
    // Finalmente elimina el documento del proceso.
    await remove('processes', id)
    await logHistory(
      {
        entityType: 'process',
        entityId: id,
        entityTitle: process.title,
        action: 'delete',
        summary: `Eliminó ${process.kind === 'solicitud' ? 'la solicitud' : 'el proceso'} (responsable: ${userName(state, process.ownerId)})`,
      },
      actor,
    )
  }
