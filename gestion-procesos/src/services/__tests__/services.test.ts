import { analyze, classify, estimatePriority, summarize } from '../ai'
import { can } from '../permissions'
import { DEFAULT_WORKFLOW, canTransition, isFinalState, nextStates } from '../workflow'
import { detectLanguage } from '../translation'

describe('permisos', () => {
  it('el administrador gestiona usuarios y el observador no puede crear', () => {
    expect(can('admin', 'users:manage')).toBe(true)
    expect(can('manager', 'users:manage')).toBe(false)
    expect(can('viewer', 'process:create')).toBe(false)
    expect(can(undefined, 'dashboard:view')).toBe(false)
  })
})

describe('workflow', () => {
  it('solo permite avanzar o retroceder un estado', () => {
    expect(nextStates(DEFAULT_WORKFLOW, 'Borrador')).toEqual(['En revisión'])
    expect(canTransition(DEFAULT_WORKFLOW, 'Borrador', 'Finalizado')).toBe(false)
    expect(isFinalState(DEFAULT_WORKFLOW, 'Finalizado')).toBe(true)
  })
})

describe('asistente IA local', () => {
  it('clasifica y estima prioridad', () => {
    expect(classify('Error en el servidor, no tengo acceso al sistema')).toBe('Tecnología')
    expect(estimatePriority('Es URGENTE, el servicio está bloqueado')).toBe('urgent')
    expect(analyze('Solicito reembolso de una factura.').category).toBe('Finanzas')
  })
  it('resume en dos frases', () => {
    const text =
      'Primera frase larga sobre el pago. Segunda sobre la factura del pago. Tercera sin relación alguna. Cuarta frase más.'
    expect(summarize(text).split('. ').length).toBeLessThanOrEqual(2)
  })
})

describe('traducción', () => {
  it('detecta idioma', () => {
    expect(detectLanguage('Hola, gracias por el apoyo')).toBe('es')
    expect(detectLanguage('Hello, thanks for the help with this')).toBe('en')
  })
})

describe('permisos de historial y workflows', () => {
  it('todos los roles pueden ver workflows e historial, pero solo admin y gestor los gestionan', () => {
    for (const role of ['admin', 'manager', 'member', 'viewer'] as const) {
      expect(can(role, 'workflow:view')).toBe(true)
      expect(can(role, 'history:view')).toBe(true)
    }
    expect(can('member', 'workflow:manage')).toBe(false)
    expect(can('manager', 'workflow:manage')).toBe(true)
  })
})
