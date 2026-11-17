import type { Priority } from '../models'

/**
 * Asistente de IA 100 % local y gratuito: no usa claves ni servicios externos.
 * Clasifica, estima prioridad, resume (extractivo) y sugiere próximos pasos.
 */
export interface AIResult {
  category: string
  priority: Priority
  summary: string
  suggestions: string[]
}

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const CATEGORIES: Record<string, string[]> = {
  Tecnología: [
    'sistema',
    'software',
    'error',
    'servidor',
    'acceso',
    'aplicacion',
    'bug',
    'red ',
    'base de datos',
    'correo',
  ],
  Finanzas: ['pago', 'factura', 'presupuesto', 'costo', 'reembolso', 'compra', 'cobro'],
  'Recursos humanos': [
    'vacaciones',
    'contrato laboral',
    'empleado',
    'nomina',
    'capacitacion',
    'permiso',
    'contratacion',
  ],
  Legal: ['legal', 'cumplimiento', 'norma', 'licencia', 'clausula', 'contrato'],
  Operaciones: ['entrega', 'inventario', 'proveedor', 'logistica', 'produccion', 'mantenimiento', 'bodega'],
  'Atención al cliente': ['cliente', 'queja', 'reclamo', 'soporte', 'garantia', 'devolucion'],
}

const NEXT_STEPS: Record<string, string[]> = {
  Tecnología: ['Reproducir el problema y registrar los pasos', 'Asignar a una persona del equipo técnico'],
  Finanzas: ['Verificar el soporte o comprobante', 'Solicitar aprobación del responsable de presupuesto'],
  'Recursos humanos': ['Confirmar la solicitud con el área de talento humano', 'Notificar a la persona interesada'],
  Legal: ['Pedir revisión del área jurídica', 'Anexar los documentos de respaldo'],
  Operaciones: ['Confirmar disponibilidad con el proveedor o la bodega', 'Definir fecha de entrega'],
  'Atención al cliente': [
    'Responder a la persona afectada en el menor tiempo posible',
    'Registrar la causa para evitar que se repita',
  ],
  General: ['Definir una persona responsable', 'Acordar una fecha límite'],
}

const STOP = new Set(
  'de la que el en y a los del se las por un para con no una su al lo como mas pero sus le ya o este si porque esta entre cuando muy sin sobre tambien me hasta hay donde quien desde todo nos durante todos uno les ni contra otros ese eso ante ellos e esto antes algunos unos yo otro otras otra tanto esa estos mucho nada muchos cual poco ella estar estas algo es son fue ha han ser the and to of is in for on with'.split(
    ' ',
  ),
)

export function classify(text: string): string {
  const t = ` ${normalize(text)} `
  let best = 'General'
  let bestScore = 0
  for (const [category, words] of Object.entries(CATEGORIES)) {
    const score = words.filter((w) => t.includes(w)).length
    if (score > bestScore) {
      best = category
      bestScore = score
    }
  }
  return best
}

export function estimatePriority(text: string): Priority {
  const t = normalize(text)
  if (/(urgente|inmediat|critico|bloquead|caida|emergencia)/.test(t)) return 'urgent'
  if (/(importante|prioridad|pronto|vence|plazo|lo antes posible)/.test(t)) return 'high'
  if (/(sin prisa|opcional|cuando pueda|baja prioridad)/.test(t)) return 'low'
  return 'medium'
}

export function summarize(text: string, maxSentences = 2): string {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (sentences.length <= maxSentences) return text.trim()
  const words = (s: string) => (normalize(s).match(/[a-z]{3,}/g) ?? []).filter((w) => !STOP.has(w))
  const freq = new Map<string, number>()
  sentences.forEach((s) => words(s).forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1)))
  const scored = sentences.map((s, index) => {
    const ws = words(s)
    const score = ws.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0) / Math.sqrt(ws.length || 1)
    return { s, index, score }
  })
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map((x) => x.s)
    .join(' ')
}

export function analyze(text: string): AIResult {
  const category = classify(text)
  const priority = estimatePriority(text)
  const suggestions = [...(NEXT_STEPS[category] ?? NEXT_STEPS.General)]
  if (priority === 'urgent' || priority === 'high') suggestions.unshift('Atender primero: la prioridad es alta')
  return { category, priority, summary: summarize(text), suggestions: suggestions.slice(0, 4) }
}
