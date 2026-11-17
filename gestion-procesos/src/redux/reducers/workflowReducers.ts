import type { Workflow } from '../../models'
import { createCollectionSlice } from './collectionSlice'

/** Solo workflows personalizados; el flujo estándar se añade en el selector. */
export const workflowSlice = createCollectionSlice<Workflow>('workflow')
export const { setItems: setWorkflows, setError: workflowError } = workflowSlice.actions
export const workflowReducer = workflowSlice.reducer
