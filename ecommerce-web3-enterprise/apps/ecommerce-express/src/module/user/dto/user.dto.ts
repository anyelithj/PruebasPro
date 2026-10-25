// user.dto.ts => contratos de entrada/salida del módulo User
import type { Locale } from "../../../shared/util/i18n.util";
import type { UpdateProfileInput } from "../schema/user.schema";
import type { AddressShape } from "../types/user.types";

// UpdateProfileDto => alias explícito (hoy es igual al input validado; se separa por si crece)
export type UpdateProfileDto = UpdateProfileInput;

// UserListItemDto => forma reducida de un usuario dentro de un LISTADO (no expone todos los campos)
export interface UserListItemDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  isActive: boolean;
  isVerified: boolean;
  roles: string[];
}

// UserDetailDto => forma completa de un usuario en la vista de DETALLE (perfil propio o admin)
// "extends" => hereda todos los campos del ítem de listado (DRY) y agrega los propios del detalle
export interface UserDetailDto extends UserListItemDto {
  phone: string | null;
  phoneVerified: boolean; // RF-01.1: el teléfono se confirmó con el código SMS
  birthDate: string | null; // RF-13.3 / RF-14.1 "YYYY-MM-DD"
  twoFactorEnabled: boolean;
  walletAddress: string | null;
  locale: Locale; // Idioma preferido del usuario
  addresses: AddressDto[]; // Matriz: "perfil completo por ID con direcciones"
  createdAt: Date;
}

// AddressDto => la dirección se expone tal como se persiste (no tiene campos sensibles)
export type AddressDto = AddressShape;

// UserDataExportDto => RF-02.6 / RNF-20 (GDPR art. 20, portabilidad): copia de los datos personales en JSON legible
// por máquina. "Record<string, unknown>[]" => cada sección es una lista de objetos planos (sin entidades internas)
export interface UserDataExportDto {
  exportedAt: string; // ISO 8601
  profile: Omit<UserDetailDto, "addresses" | "roles"> & { roles: string[] }; // "Omit" => tipo utilitario: quita claves
  addresses: AddressDto[];
  wishlist: Array<{ productId: string; name: string; slug: string; addedAt: Date }>;
  orders: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
  loyalty: Record<string, unknown> | null;
  notificationPreferences: Record<string, unknown> | null;
  linkedAccounts: Array<{ provider: string; linkedAt: Date }>;
  sessions: Array<{ createdAt: Date; userAgent: string | null; ipAddress: string | null; isRevoked: boolean }>;
}
