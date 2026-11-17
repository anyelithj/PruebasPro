// [chunk-reload · 2026-10-30]: «Failed to fetch dynamically imported module: /ng/chunk-XXXX.js» → el remoto se recompiló o se desplegó y esa pantalla apuntaba a un archivo que ya no existe; recargar trae los nombres nuevos
// [Patrón]: Error Recovery + Guard (como mucho una recarga cada RETRY_MS → un 500 real del servidor no entra en bucle) | [Principio]: SRP | [Paradigma]: Funcional
const KEY = 'aula-chunk-reload';
const RETRY_MS = 30_000;

// [isChunkError]: mensajes de Chromium/Firefox («dynamically imported module») y de Safari («Importing a module script failed») | `String(err)`: tolera valores que no son Error
export const isChunkError = (err: unknown): boolean => /dynamically imported module|Importing a module script failed/i.test(String(err));

// [reloadOnChunkError]: devuelve true si lanzó la recarga completa hacia `url` | `sessionStorage` (Web Storage) + `try/catch`: con el almacenamiento bloqueado no se recarga (evita el bucle)
export function reloadOnChunkError(err: unknown, url: string, navigate: (url: string) => void = (u) => location.assign(u)): boolean {
  if (!isChunkError(err)) return false;
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < RETRY_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  navigate(url);
  return true;
}
