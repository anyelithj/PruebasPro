const pad = (n: number) => String(n).padStart(2, '0')

/** Fecha local en formato AAAA-MM-DD. */
export const toIso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayIso = (now: number = Date.now()): string => toIso(new Date(now))
export const addDaysIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toIso(d)
}
export const DAY_MS = 86_400_000
