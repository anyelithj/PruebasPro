// [Clave de objeto · Sprint 6.7]: validación compartida por LocalObjectStore y S3ObjectStore | [Principio]: DRY + Fail Fast | [Paradigma]: Funcional (pura)
// [KEY]: claves generadas por el código (UUID, hash, rutas de audio) → letras, dígitos, «-», «_», «.» y «/», sin segmentos «..» | [Seguridad]: anti path-traversal en disco y en S3
const KEY = /^(?!.*(?:^|\/)\.\.(?:\/|$))[\w\-./]+$/;
export function assertKey(key: string): void {
  if (!KEY.test(key) || key.startsWith('/'))
    throw new Error('Clave de almacenamiento inválida');
}
