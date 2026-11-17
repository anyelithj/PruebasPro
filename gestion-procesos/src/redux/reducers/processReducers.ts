// Slice de PROCESOS: usa la fábrica de collectionSlice.ts, por eso el archivo es tan corto (DRY).
import type { Process } from '../../models'
import { createCollectionSlice } from './collectionSlice'

// Crea el slice indicando que sus elementos son de tipo `Process` (genérico <Process>).
export const processSlice = createCollectionSlice<Process>('process')
// Desestructuración con renombrado: toma las acciones `setItems` y `setError` y las exporta como setProcesses y processError.
export const { setItems: setProcesses, setError: processError } = processSlice.actions
// El reducer que se registra en el store (store.ts).
export const processReducer = processSlice.reducer
