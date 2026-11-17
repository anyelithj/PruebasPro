#!/usr/bin/env node
/**
 * Prepara la base de datos de Firebase desde la terminal.
 *
 *   pnpm db:check                                   → solo valida el esquema (no se conecta)
 *   pnpm db:setup --project mi-proyecto --key clave.json
 *   pnpm db:setup --project mi-proyecto --key clave.json --admin ana@empresa.co
 *
 * Qué hace:
 *   1. Valida database/schema.json y lo compara con firestore.rules.
 *   2. Guarda el esquema como documento `_meta/schema` en Firestore (queda versionado en la propia base).
 *   3. Con --admin, convierte en administrador a una persona que ya existe en Firebase Authentication.
 *
 * Las reglas e índices se publican con: pnpm db:deploy
 * (Firestore crea las colecciones al guardar el primer documento, por eso no hay «CREATE TABLE».)
 */
// `import`: trae funciones de otros módulos. `node:` indica que son módulos que trae Node.js.
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// `import.meta.url` es la ruta de ESTE archivo; así encontramos database/ sin importar desde dónde se ejecute.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ───────────────────────── Argumentos de la terminal ─────────────────────────
const args = process.argv.slice(2) // process.argv[0] y [1] son «node» y el archivo; el resto son los argumentos
const flag = (name) => args.includes(`--${name}`) // ¿se escribió --nombre?
const option = (name) => {
  const i = args.indexOf(`--${name}`) // posición de --nombre
  return i >= 0 ? args[i + 1] : undefined // el valor es la palabra siguiente
}

if (flag('help')) {
  console.log('Uso: node scripts/firebase-setup.mjs [--dry-run] [--project ID] [--key ruta.json] [--admin correo]')
  process.exit(0)
}

// ───────────────────────── 1. Validar el esquema ─────────────────────────
const schema = JSON.parse(readFileSync(resolve(root, 'database/schema.json'), 'utf8'))
const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8')

/** Devuelve la lista de problemas encontrados (vacía = todo bien). */
export function validateSchema(schema, rulesText) {
  const problems = []
  // Las subcolecciones (p. ej. channels/messages) también tienen su bloque `match` en las reglas.
  const subcollections = Object.values(schema.collections).flatMap((c) => Object.keys(c.subcollections ?? {}))
  const names = [...Object.keys(schema.collections), ...subcollections]

  for (const [name, collection] of Object.entries(schema.collections)) {
    if (!collection.description) problems.push(`${name}: falta la descripción`)
    if (!collection.fields || Object.keys(collection.fields).length === 0) problems.push(`${name}: no tiene campos`)
    for (const [field, def] of Object.entries(collection.fields ?? {})) {
      if (!def.type) problems.push(`${name}.${field}: falta el tipo`)
      if (def.enum && def.enum.length === 0) problems.push(`${name}.${field}: la lista de valores está vacía`)
    }
  }

  // Cada colección con reglas de seguridad debe existir en el esquema, y al revés.
  const inRules = [...rulesText.matchAll(/match \/(\w+)\/\{/g)].map((m) => m[1]).filter((n) => n !== 'databases')
  for (const n of inRules) if (!names.includes(n)) problems.push(`«${n}» está en firestore.rules pero no en el esquema`)
  for (const n of names) if (!inRules.includes(n)) problems.push(`«${n}» está en el esquema pero no en firestore.rules`)
  return problems
}

const problems = validateSchema(schema, rules)
if (problems.length > 0) {
  console.error('El esquema tiene problemas:\n - ' + problems.join('\n - '))
  process.exit(1)
}
const collectionNames = Object.keys(schema.collections)
console.log(`✔ Esquema válido (versión ${schema.version}): ${collectionNames.length} colecciones`)
console.log(`  ${collectionNames.join(', ')}`)

if (flag('dry-run')) {
  console.log('\nModo de prueba: no se escribió nada en Firebase.')
  process.exit(0)
}

// ───────────────────────── 2. Conectarse con firebase-admin ─────────────────────────
const projectId = option('project') ?? process.env.GCLOUD_PROJECT
const keyPath = option('key') ?? process.env.GOOGLE_APPLICATION_CREDENTIALS
if (!projectId || !keyPath) {
  console.error(
    '\nFalta el proyecto o la clave de servicio.\n' +
      '  1) Firebase Console → Configuración del proyecto → Cuentas de servicio → «Generar nueva clave privada».\n' +
      '  2) pnpm db:setup --project <id-del-proyecto> --key <ruta-a-la-clave.json>\n' +
      'La clave da acceso total a tu base de datos: no la subas a Git.',
  )
  process.exit(1)
}

// Se importa aquí (y no arriba) para que `--dry-run` funcione aunque firebase-admin no estuviera instalado.
const { initializeApp, cert } = await import('firebase-admin/app')
const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
const { getAuth } = await import('firebase-admin/auth')

initializeApp({ credential: cert(JSON.parse(readFileSync(resolve(keyPath), 'utf8'))), projectId })
const db = getFirestore()

// ───────────────────────── 3. Guardar el esquema en `_meta/schema` ─────────────────────────
await db
  .collection('_meta')
  .doc('schema')
  .set({
    version: schema.version,
    updatedAt: FieldValue.serverTimestamp(),
    collections: Object.fromEntries(
      Object.entries(schema.collections).map(([name, c]) => [
        name,
        {
          description: c.description,
          requiredFields: Object.entries(c.fields)
            .filter(([, f]) => f.required)
            .map(([field]) => field),
        },
      ]),
    ),
  })
console.log('✔ Esquema guardado en _meta/schema')

// ───────────────────────── 4. Crear el primer administrador (opcional) ─────────────────────────
const adminEmail = option('admin')
if (adminEmail) {
  // La persona debe haberse registrado antes en la aplicación (o existir en Authentication).
  const user = await getAuth().getUserByEmail(adminEmail)
  const ref = db.collection('users').doc(user.uid)
  const existing = await ref.get()
  await ref.set(
    {
      uid: user.uid,
      email: user.email ?? adminEmail,
      displayName: user.displayName ?? adminEmail.split('@')[0],
      photoURL: user.photoURL ?? null,
      role: 'admin',
      active: true,
      // Solo se completan estos campos si el perfil aún no existía; si existía, se respetan.
      ...(existing.exists ? {} : { position: '', createdAt: Date.now() }),
    },
    { merge: true },
  )
  console.log(`✔ ${adminEmail} ahora es administrador`)
}

console.log('\nSiguiente paso: pnpm db:deploy   (publica firestore.rules e índices)')
