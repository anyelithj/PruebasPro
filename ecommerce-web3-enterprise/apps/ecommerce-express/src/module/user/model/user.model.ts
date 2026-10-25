// user.model.ts => Entidad de dominio User para el contexto de "gestión de perfil" (POO)
// Nota: es DISTINTA (aunque similar) a auth.model.ts, porque cada módulo modela SOLO lo que necesita
// de la entidad compartida "User" (principio ISP — Interface Segregation aplicado a nivel de módulo)
import type { Locale } from "../../../shared/util/i18n.util";
import type { UserDetailDto, UserListItemDto } from "../dto/user.dto";
import type { AddressShape } from "../types/user.types";

export interface UserProfilePersistenceShape {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  phone: string | null;
  phoneVerifiedAt: Date | null; // RF-01.1
  birthDate: Date | null; // RF-13.3 / RF-14.1 cumpleaños
  isActive: boolean;
  isVerified: boolean;
  twoFactorEnabled: boolean;
  walletAddress: string | null;
  locale: Locale; // Idioma preferido (es/en) para emails y notificaciones
  roles: string[];
  addresses: AddressShape[];
  createdAt: Date;
}

export class UserProfileEntity {
  // "private readonly data" => el estado completo queda encapsulado; se expone solo lo necesario
  constructor(private readonly data: UserProfilePersistenceShape) {}

  public get id(): string {
    return this.data.id;
  }

  public get roles(): string[] {
    return this.data.roles;
  }

  public get phone(): string | null {
    return this.data.phone;
  }

  public get isActive(): boolean {
    // "get" => getter de TypeScript/JS: se accede como propiedad (user.isActive), no como método (user.isActive())
    return this.data.isActive;
  }

  // Regla de negocio GDPR: solo se puede "soft-delete" una cuenta activa (evita doble desactivación)
  public canBeDeactivated(): boolean {
    return this.data.isActive;
  }

  public hasRole(roleName: string): boolean {
    return this.data.roles.includes(roleName);
  }

  public toListItemJSON(): UserListItemDto {
    return {
      id: this.data.id,
      email: this.data.email,
      firstName: this.data.firstName,
      lastName: this.data.lastName,
      avatarUrl: this.data.avatarUrl,
      isActive: this.data.isActive,
      isVerified: this.data.isVerified,
      roles: this.data.roles,
    };
  }

  public toDetailJSON(): UserDetailDto {
    // Spread del ítem de listado + campos de detalle (DRY: no se repiten los campos comunes)
    return {
      ...this.toListItemJSON(),
      phone: this.data.phone,
      phoneVerified: this.data.phoneVerifiedAt !== null, // Booleano derivado: no se expone la fecha interna
      birthDate: this.data.birthDate ? this.data.birthDate.toISOString().slice(0, 10) : null, // "YYYY-MM-DD" (fecha sin hora)
      twoFactorEnabled: this.data.twoFactorEnabled,
      walletAddress: this.data.walletAddress,
      locale: this.data.locale,
      addresses: this.data.addresses,
      createdAt: this.data.createdAt,
    };
  }
}
