import type { FileRecord } from '../../models'
import { createCollectionSlice } from './collectionSlice'

export const fileSlice = createCollectionSlice<FileRecord>('file')
export const { setItems: setFiles, setError: fileError } = fileSlice.actions
export const fileReducer = fileSlice.reducer
