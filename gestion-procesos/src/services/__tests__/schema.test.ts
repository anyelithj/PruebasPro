/** @jest-environment node */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PRIORITIES,
  ROLES,
  TASK_STATUSES,
  withProcessDefaults,
  withProfileDefaults,
  withTaskDefaults,
  type Priority,
  type Role,
  type TaskStatus,
} from '../../models'

const root = resolve(__dirname, '../../..')
const schema = JSON.parse(readFileSync(resolve(root, 'database/schema.json'), 'utf8'))
const rules = readFileSync(resolve(root, 'firestore.rules'), 'utf8')

type Fields = Record<string, { required?: boolean; enum?: string[] }>
const fieldsOf = (collection: string): Fields => schema.collections[collection].fields
const requiredOf = (collection: string) =>
  Object.entries(fieldsOf(collection))
    .filter(([, f]) => f.required)
    .map(([name]) => name)
    .sort()

describe('esquema de la base de datos (database/schema.json)', () => {
  it('cubre todas las colecciones de las reglas de seguridad', () => {
    const inRules = [...rules.matchAll(/match \/(\w+)\/\{/g)].map((m) => m[1]).filter((n) => n !== 'databases')
    const known = [...Object.keys(schema.collections), 'messages']
    inRules.forEach((name) => expect(known).toContain(name))
  })

  it('usa los mismos valores permitidos que el código', () => {
    expect(fieldsOf('users').role.enum).toEqual(ROLES satisfies Role[])
    expect(fieldsOf('processes').priority.enum).toEqual(PRIORITIES satisfies Priority[])
    expect(fieldsOf('tasks').status.enum).toEqual(TASK_STATUSES satisfies TaskStatus[])
  })

  it('los campos obligatorios de procesos coinciden con el modelo', () => {
    const modelFields = Object.keys(withProcessDefaults({ id: 'x' })).filter((k) => k !== 'id')
    expect(requiredOf('processes')).toEqual(modelFields.sort())
  })

  it('los campos obligatorios de tareas coinciden con el modelo', () => {
    const modelFields = Object.keys(withTaskDefaults({ id: 'x' })).filter((k) => k !== 'id')
    expect(requiredOf('tasks')).toEqual(modelFields.sort())
  })

  it('los campos obligatorios de usuarios están en el perfil por defecto', () => {
    const profile = withProfileDefaults({ uid: 'u', email: 'a@b.co', displayName: 'A', photoURL: null })
    requiredOf('users').forEach((name) => expect(profile).toHaveProperty(name))
  })
})
