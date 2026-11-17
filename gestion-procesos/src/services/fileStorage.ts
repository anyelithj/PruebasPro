import { env } from '../config/env'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { app, db } from '../firebase/firebaseConfig'
import type { FileRecord } from '../models'

/**
 * Adapter para guardar archivos. Dos implementaciones intercambiables según VITE_FILES_BACKEND:
 *  - «firestore» (por defecto, gratuito): guarda el archivo en base64 dentro de Firestore. Límite ~600 KB por archivo.
 *  - «storage»: Cloud Storage de Firebase. Sin límite práctico, pero Firebase puede exigir el plan Blaze para crear el bucket.
 */
export interface FileBackend {
  name: FileRecord['backend']
  maxBytes: number
  upload(
    file: File,
    record: Pick<FileRecord, 'id' | 'entityType' | 'entityId' | 'uploadedBy'>,
  ): Promise<{ path: string }>
  download(record: FileRecord): Promise<Blob>
  remove(record: FileRecord): Promise<void>
}

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const fromBase64 = (data: string, mime: string): Blob => {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

const firestoreBackend: FileBackend = {
  name: 'firestore',
  maxBytes: 600 * 1024,
  async upload(file, record) {
    await setDoc(doc(db, 'fileBlobs', record.id), { data: await toBase64(file), uploadedBy: record.uploadedBy })
    return { path: '' }
  },
  async download(record) {
    const snap = await getDoc(doc(db, 'fileBlobs', record.id))
    if (!snap.exists()) throw new Error('Archivo no encontrado')
    return fromBase64(snap.data().data as string, record.mime)
  },
  async remove(record) {
    await deleteDoc(doc(db, 'fileBlobs', record.id))
  },
}

const storageBackend: FileBackend = {
  name: 'storage',
  maxBytes: 10 * 1024 * 1024,
  async upload(file, record) {
    const { getStorage, ref, uploadBytes } = await import('firebase/storage')
    const path = `files/${record.entityType}/${record.entityId}/${record.id}-${file.name}`
    await uploadBytes(ref(getStorage(app), path), file)
    return { path }
  },
  async download(record) {
    const { getStorage, ref, getBlob } = await import('firebase/storage')
    return getBlob(ref(getStorage(app), record.path))
  },
  async remove(record) {
    const { getStorage, ref, deleteObject } = await import('firebase/storage')
    await deleteObject(ref(getStorage(app), record.path))
  },
}

export const activeBackend: FileBackend = env.filesBackend === 'storage' ? storageBackend : firestoreBackend

/** Elige la implementación con la que se guardó cada archivo (por si se cambia de backend más adelante). */
export const backendFor = (record: FileRecord): FileBackend =>
  record.backend === 'storage' ? storageBackend : firestoreBackend

export const formatBytes = (n: number): string =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`
