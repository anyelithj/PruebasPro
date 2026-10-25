// [Rol de UI del portal]: módulo neutro (sin "use client") → lo usan Server y Client Components | [Patrón]: Facade de re-exportación + SSOT | [Principio]: DRY
// [Por qué aparte]: una función exportada desde un archivo "use client" llega al servidor como referencia de cliente y NO se puede invocar allí
// [Origen]: config/navigation.ts (compartido con el shell Angular) → aquí solo se re-exporta para no romper los imports existentes
export { toPortalRole, ROLE_GRADIENT, initialsFromName, type PortalRole } from "@aula/shared-nav/navigation";
