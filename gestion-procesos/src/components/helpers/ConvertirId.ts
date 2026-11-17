/** Convierte un texto en un identificador legible para URLs (p. ej. nombres de canal). */
export const convertirId = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const formatDate = (value: string | number): string => {
  if (!value) return 'Sin fecha'
  const date = typeof value === 'string' ? new Date(`${value}T00:00:00`) : new Date(value)
  return date.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const formatTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
