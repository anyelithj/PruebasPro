#!/usr/bin/env node
/**
 * Comprueba que la configuración de Firebase (.env) esté completa y explica qué está mal.
 *
 *   pnpm env:check            → informa y termina con código 0 (modo aviso)
 *   node scripts/check-env.mjs --strict   → termina con código 1 si falta algo (lo usa Docker al construir la imagen)
 *
 * Nunca imprime los valores de las claves: solo los nombres de las variables.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const strict = process.argv.includes('--strict')
const root = process.cwd() // la carpeta desde donde se ejecuta (debe ser la raíz del proyecto, junto a package.json)

// Campos sin los cuales Firebase no puede iniciar. Se aceptan los prefijos VITE_ y REACT_APP_.
const REQUIRED = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID', 'FIREBASE_APP_ID']

/** Lee un archivo .env y devuelve { NOMBRE: valor }. Ignora comentarios y líneas vacías, y quita comillas. */
function parseEnvFile(path) {
  const vars = {}
  for (const rawLine of readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, '')
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const index = line.indexOf('=')
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1)
    vars[key] = value
  }
  return vars
}

// Orden de lectura igual al de Vite: .env, luego .env.local; las variables del sistema (Docker, terminal) ganan.
const files = ['.env', '.env.local'].map((name) => resolve(root, name)).filter((p) => existsSync(p))
const fromFiles = Object.assign({}, ...files.map(parseEnvFile))
const vars = { ...fromFiles, ...process.env }
const read = (name) => vars[`VITE_${name}`]?.trim() || vars[`REACT_APP_${name}`]?.trim() || ''

const missing = REQUIRED.filter((name) => !read(name))
console.log(`\nRevisión de la configuración de Firebase (carpeta: ${root})`)

if (missing.length === 0) {
  console.log('✔ Configuración completa: ' + REQUIRED.map((n) => `VITE_${n}`).join(', '))
  if (!read('FIREBASE_API_KEY').startsWith('AIza')) {
    console.log(
      '⚠ La clave de API no empieza con «AIza», como suelen hacerlo las de Firebase. Si el inicio de sesión falla, vuelve a copiarla de la consola.',
    )
  }
  process.exit(0)
}

console.log('✘ Faltan estas variables (o están vacías):')
missing.forEach((name) => console.log(`   - VITE_${name}`))

console.log('\nPosibles causas:')
if (files.length === 0) {
  console.log(`   • No existe el archivo .env en ${root}`)
  const lookalikes = ['.env.txt', 'env', '.env.example.txt', '.env.local.txt'].filter((n) =>
    existsSync(resolve(root, n)),
  )
  if (lookalikes.length)
    console.log(
      `     Encontré «${lookalikes.join('», «')}»: el archivo debe llamarse exactamente «.env» (sin .txt). En Windows activa «Extensiones de nombre de archivo» para verlo.`,
    )
  console.log('     Crea el archivo copiando .env.example:  cp .env.example .env   (Windows: copy .env.example .env)')
  if (existsSync(resolve(root, '.env.example'))) {
    const example = parseEnvFile(resolve(root, '.env.example'))
    if (REQUIRED.every((n) => example[`VITE_${n}`]))
      console.log('     OJO: llenaste .env.example, pero Vite solo lee «.env». Copia ese contenido a .env.')
  }
} else {
  console.log(`   • Se leyó: ${files.map((f) => f.replace(root, '.')).join(', ')}`)
  const names = Object.keys(fromFiles)
  console.log(`     Variables que contiene: ${names.length ? names.join(', ') : '(ninguna: el archivo está vacío)'}`)
  const wrong = names.filter(
    (n) => !/^(VITE_|REACT_APP_)/.test(n) && /FIREBASE|API_KEY|AUTH_DOMAIN|PROJECT_ID|APP_ID/i.test(n),
  )
  if (wrong.length)
    console.log(
      `   • Estas variables no empiezan con VITE_ y Vite las ignora: ${wrong.join(', ')}. Renómbralas, por ejemplo VITE_FIREBASE_API_KEY.`,
    )
  const empty = REQUIRED.filter((n) => `VITE_${n}` in fromFiles && !fromFiles[`VITE_${n}`].trim())
  if (empty.length)
    console.log(
      `   • Están en el archivo pero vacías: ${empty.map((n) => `VITE_${n}`).join(', ')}. Escribe el valor después del signo =.`,
    )
}
console.log(
  '   • Si acabas de editar .env: detén el servidor (Ctrl + C) y vuelve a iniciarlo. Con Docker: docker compose up --build.',
)
console.log('   • El archivo debe estar en la raíz del proyecto, junto a package.json (no dentro de src).')
console.log('   • El formato es NOMBRE=valor, sin espacios alrededor del = y una variable por línea.\n')

process.exit(strict ? 1 : 0)
