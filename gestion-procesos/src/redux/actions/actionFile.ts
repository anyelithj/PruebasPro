import { saveAs } from 'file-saver'
import type { FileRecord } from '../../models'
import { activeBackend, backendFor, formatBytes } from '../../services/fileStorage'
import { remove, save } from '../../services/firestoreService'
import { logHistory } from '../../services/history'
import type { AppThunk } from '../store/store'
import { getActor } from './actionHelpers'

export const uploadFile =
  (file: File, entityType: FileRecord['entityType'], entityId: string, entityTitle: string): AppThunk<Promise<void>> =>
  async (_dispatch, getState) => {
    const actor = getActor(getState())
    if (file.size > activeBackend.maxBytes)
      throw new Error(`El archivo supera el límite de ${formatBytes(activeBackend.maxBytes)}.`)
    const id = crypto.randomUUID()
    const { path } = await activeBackend.upload(file, { id, entityType, entityId, uploadedBy: actor.uid })
    const record: Omit<FileRecord, 'id'> = {
      entityType,
      entityId,
      entityTitle,
      name: file.name,
      size: file.size,
      mime: file.type || 'application/octet-stream',
      backend: activeBackend.name,
      path,
      uploadedBy: actor.uid,
      uploaderName: actor.name,
      createdAt: Date.now(),
    }
    await save('files', id, record)
    await logHistory({ entityType, entityId, entityTitle, action: 'file', summary: `Adjuntó «${file.name}»` }, actor)
  }

export const downloadFile =
  (record: FileRecord): AppThunk<Promise<void>> =>
  async () => {
    saveAs(await backendFor(record).download(record), record.name)
  }

export const deleteFile =
  (record: FileRecord): AppThunk<Promise<void>> =>
  async (_dispatch, getState) => {
    const actor = getActor(getState())
    await backendFor(record).remove(record)
    await remove('files', record.id)
    await logHistory(
      {
        entityType: record.entityType,
        entityId: record.entityId,
        entityTitle: record.entityTitle,
        action: 'file',
        summary: `Eliminó el archivo «${record.name}»`,
      },
      actor,
    )
  }
