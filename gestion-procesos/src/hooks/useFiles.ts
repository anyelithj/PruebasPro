import { useCallback, useMemo } from 'react'
import type { FileRecord } from '../models'
import { deleteFile, downloadFile, uploadFile } from '../redux/actions/actionFile'
import { useAppDispatch, useAppSelector } from './useRedux'

/** Archivos de una entidad (proceso o tarea) o todos si no se indica. */
export function useFiles(entityType?: FileRecord['entityType'], entityId?: string) {
  const dispatch = useAppDispatch()
  const all = useAppSelector((s) => s.file.items)
  const files = useMemo(
    () => (entityId ? all.filter((f) => f.entityType === entityType && f.entityId === entityId) : all),
    [all, entityType, entityId],
  )

  return {
    files,
    upload: useCallback(
      (file: File, type: FileRecord['entityType'], id: string, title: string) =>
        dispatch(uploadFile(file, type, id, title)),
      [dispatch],
    ),
    download: useCallback((f: FileRecord) => dispatch(downloadFile(f)), [dispatch]),
    remove: useCallback((f: FileRecord) => dispatch(deleteFile(f)), [dispatch]),
  }
}
