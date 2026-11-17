// ═══════════════════════════════════════════════════════════════════════════════════════
// firestoreService.ts — ÚNICA puerta de entrada a Cloud Firestore.
// Patrón: FACADE (fachada): ofrece 5 funciones simples (subscribe, create, patch, save, remove, read) y esconde los
// detalles del SDK de Firebase. Si algún día se cambia de base de datos, solo se reescribe este archivo.
// Arquitectura: capa de INFRAESTRUCTURA (la más baja: no conoce React ni Redux).
// Paradigma ASÍNCRONO: hablar con la nube toma tiempo, por eso devuelven Promesas (`Promise`) o usan callbacks.
// ═══════════════════════════════════════════════════════════════════════════════════════

// Funciones del SDK modular de Firebase: cada una se importa por separado para que el empaquetador elimine lo que no se usa
// (tree-shaking → aplicación más liviana).
import {
  addDoc, // agrega un documento con id automático
  collection, // referencia a una colección (como «una tabla»)
  deleteDoc, // elimina un documento
  doc, // referencia a UN documento
  getDoc, // lee un documento una sola vez
  onSnapshot, // escucha cambios en TIEMPO REAL
  query, // arma una consulta con filtros/orden
  setDoc, // crea o reemplaza un documento
  updateDoc, // modifica solo algunos campos
  writeBatch, // agrupa varias escrituras en una sola operación atómica
  type DocumentData, // tipo: objeto con los datos de un documento
  type QueryConstraint, // tipo: un filtro u orden (where, orderBy…)
} from 'firebase/firestore'
// `db`: la conexión a la base de datos (ver firebaseConfig.ts).
import { db } from '../firebase/firebaseConfig'

/** Facade: el resto de la app no conoce los detalles del SDK de Firestore. */

// PATRÓN OBSERVER: `subscribe` registra un oyente; Firestore lo llama cada vez que cambian los datos.
// `export function`: función exportada. `<T extends { id: string }>`: genérico: T es el tipo de documento y debe tener `id`.
export function subscribe<T extends { id: string }>(
  // Ruta de la colección, p. ej. 'processes' o 'channels/abc/messages' (subcolección).
  path: string,
  // Lista de filtros/orden (puede ir vacía `[]`).
  constraints: QueryConstraint[],
  // Callback (función que se pasa para que otro la llame después) con la lista de documentos actualizada.
  onData: (items: T[]) => void,
  // Callback de error. `= (e) => console.error(e)`: valor por defecto del parámetro (imprime el error).
  onError: (error: Error) => void = (e) => console.error(e),
) {
  // `return`: devuelve la función para CANCELAR la suscripción (unsubscribe), que el hook usará en su limpieza.
  return onSnapshot(
    // `...constraints` (spread): reparte la lista como argumentos sueltos.
    query(collection(db, path), ...constraints),
    // Por cada documento: une sus datos con su id (`id` no viene dentro de `data()`).
    // `as unknown as T`: doble aserción de TypeScript: «confía en mí, esto tiene la forma T» (Firestore no tipa los datos).
    (snap) => onData(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as unknown as T)),
    onError,
  )
}

// CREATE (C del CRUD): agrega un documento con id automático y devuelve ese id.
// `async`: la función devuelve una Promesa y permite usar `await`. `await`: espera el resultado sin bloquear la página.
export const create = async (path: string, data: DocumentData): Promise<string> =>
  (await addDoc(collection(db, path), data)).id

// UPDATE parcial (U del CRUD): cambia SOLO los campos indicados.
export const patch = (path: string, id: string, data: DocumentData) => updateDoc(doc(db, path, id), data)

// UPSERT: crea el documento con ese id o lo mezcla con el existente (`merge: true` conserva los demás campos).
export const save = (path: string, id: string, data: DocumentData) => setDoc(doc(db, path, id), data, { merge: true })

// DELETE (D del CRUD): elimina el documento.
export const remove = (path: string, id: string) => deleteDoc(doc(db, path, id))

// READ una sola vez (R del CRUD). `Promise<T | null>`: devuelve el documento o null si no existe.
export async function read<T>(path: string, id: string): Promise<T | null> {
  // `await`: espera la respuesta de Firestore.
  const snap = await getDoc(doc(db, path, id))
  // Operador ternario `condición ? si : no`. `snap.exists()` indica si el documento existe.
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as unknown as T) : null
}

/**
 * Primer administrador: en UNA sola operación atómica (batch) crea la marca `_meta/admin` y el perfil con rol «admin».
 * Las reglas de Firestore solo permiten crear `_meta/admin` una vez, así que únicamente el primer usuario lo logra.
 */
export async function claimFirstAdmin(profile: DocumentData & { uid: string }): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(db, '_meta', 'admin'), { uid: profile.uid, createdAt: Date.now() })
  batch.set(doc(db, 'users', profile.uid), profile)
  await batch.commit()
}
