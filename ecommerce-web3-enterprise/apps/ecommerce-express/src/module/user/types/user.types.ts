// user.types.ts => tipos del módulo User compartidos entre repository y service (TypeScript puro).

// UserListFilters => filtros del listado admin (GET /user?q=&role=&isActive=)
export interface UserListFilters {
  q?: string | undefined; // Búsqueda parcial por email o nombre
  role?: string | undefined; // Solo usuarios que tengan este rol
  isActive?: boolean | undefined;
}

// BulkDeactivationCriteria => "desactivar usuarios por criterio masivo" (DELETE /user)
// Unión de criterios: o una lista explícita de IDs, o todos los inactivos antes de una fecha
export type BulkDeactivationCriteria =
  | { ids: string[]; inactiveSince?: undefined }
  | { ids?: undefined; inactiveSince: Date };

// AddressShape => forma persistida de una dirección (tabla "addresses")
export interface AddressShape {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}
