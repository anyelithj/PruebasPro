// user.repository.ts => PATRÓN Repository, mismo principio que auth.repository.ts pero enfocado
// en el caso de uso "gestión de perfil" (listado paginado, detalle, actualización parcial, GDPR, roles, direcciones)
import { isLocale, type Locale } from "../../../shared/util/i18n.util";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config"; // Singleton compartido
import { UserProfileEntity } from "../model/user.model";
import type { AddressShape, BulkDeactivationCriteria, UserListFilters } from "../types/user.types";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";
import type { AddressInput, UpdateAddressInput } from "../schema/user.schema";

// Include reutilizable: roles + direcciones (default primero) en UNA consulta (evita N+1)
const PROFILE_INCLUDE = {
  roles: { include: { role: true } },
  addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
} satisfies Prisma.UserInclude;

type ProfileRow = Prisma.UserGetPayload<{ include: typeof PROFILE_INCLUDE }>;

// Campos públicos de una dirección (excluye userId/timestamps) — "satisfies" valida contra Prisma
const ADDRESS_SELECT = {
  id: true,
  label: true,
  recipientName: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isDefault: true,
} satisfies Prisma.AddressSelect;

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // listUsers => paginación offset-based + filtros opcionales (búsqueda, rol, estado)
  public async listUsers(filters: UserListFilters, page: PageParams): Promise<Paginated<UserProfileEntity>> {
    // "Prisma.UserWhereInput" => objeto de filtro tipado; los filtros ausentes no agregan condiciones
    const where: Prisma.UserWhereInput = {
      deletedAt: null, // Las cuentas anonimizadas (GDPR) no aparecen en el panel
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.role ? { roles: { some: { role: { name: filters.role } } } } : {}),
      ...(filters.q
        ? {
            // "OR" + "contains" + "mode: insensitive" => ILIKE '%q%' sobre email, nombre o apellido
            OR: [
              { email: { contains: filters.q, mode: "insensitive" } },
              { firstName: { contains: filters.q, mode: "insensitive" } },
              { lastName: { contains: filters.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    // "Promise.all" ejecuta el COUNT y el SELECT en paralelo (2 queries independientes, más rápido que en serie)
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: page.skip,
        take: page.limit,
        orderBy: { createdAt: "desc" },
        include: PROFILE_INCLUDE,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: rows.map((row) => this.mapToEntity(row)), total };
  }

  public async findById(id: string): Promise<UserProfileEntity | null> {
    const row = await this.prisma.user.findUnique({ where: { id }, include: PROFILE_INCLUDE });
    return row ? this.mapToEntity(row) : null;
  }

  // findByEmailIncludingInactive => usado por el Validator; SÍ incluye usuarios desactivados (isActive: false)
  // porque el email de una cuenta desactivada SIGUE bloqueado para nuevos registros (regla de negocio)
  public async findByEmailIncludingInactive(email: string): Promise<{ id: string } | null> {
    // "select: { id: true }" => trae SOLO la columna id (optimización: no necesitamos el resto de campos aquí)
    return this.prisma.user.findUnique({ where: { email }, select: { id: true } });
  }

  // findPasswordHash => SOLO el hash (para el cambio de contraseña). Antes el service comparaba contra ""
  // y el cambio de contraseña fallaba siempre.
  public async findPasswordHash(id: string): Promise<string | null> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
    return row?.passwordHash ?? null;
  }

  // updateProfile => aplica un PATCH parcial (solo los campos que vienen definidos en "changes")
  public async updateProfile(
    id: string,
    changes: {
      firstName?: string | undefined;
      lastName?: string | undefined;
      phone?: string | null | undefined;
      phoneVerifiedAt?: null | undefined; // RF-01.1: cambiar el teléfono anula su verificación (solo se puede poner en null aquí)
      avatarUrl?: string | undefined;
      locale?: Locale | undefined;
      passwordHash?: string | undefined;
      birthDate?: Date | null | undefined; // RF-13.3 / RF-14.1
    }
  ): Promise<UserProfileEntity> {
    // "Object.fromEntries(...filter)" => quita las claves undefined (exactOptionalPropertyTypes + semántica PATCH)
    const data = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined)
    ) as Prisma.UserUpdateInput;
    const row = await this.prisma.user.update({ where: { id }, data, include: PROFILE_INCLUDE });
    return this.mapToEntity(row);
  }

  // exportData => RF-02.6 (GDPR portabilidad): TODOS los datos personales del usuario en UNA consulta con "select"
  // anidados (Prisma arma los JOIN; sin N+1). Nunca incluye secretos: hash de contraseña, tokens ni refresh tokens.
  public async exportData(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        wishlist: { select: { createdAt: true, product: { select: { id: true, name: true, slug: true } } } },
        orders: {
          orderBy: { placedAt: "desc" },
          select: {
            orderNumber: true, status: true, currency: true, subtotalCents: true, discountCents: true, shippingCents: true, taxCents: true,
            totalCents: true, shippingAddress: true, placedAt: true,
            items: { select: { productName: true, variantName: true, sku: true, quantity: true, unitPriceCents: true, totalCents: true } },
          },
        },
        reviews: { select: { rating: true, title: true, body: true, status: true, createdAt: true, product: { select: { name: true } } } },
        loyaltyAccount: { select: { pointsBalance: true, lifetimePoints: true, tier: true, transactions: { select: { points: true, operation: true, reason: true, createdAt: true } } } },
        notificationPrefs: true,
        oauthLinks: { select: { provider: true, createdAt: true } },
        sessions: { select: { createdAt: true, userAgent: true, ipAddress: true, isRevoked: true } },
      },
    });
  }

  // anonymizeUser => GDPR "derecho al olvido": reemplaza los datos personales por valores anónimos,
  // desactiva la cuenta y borra credenciales/vínculos. La fila se conserva: las órdenes y facturas
  // (obligación contable) siguen apuntando a un usuario existente pero ya no identificable.
  public async anonymizeUser(id: string): Promise<void> {
    // "$transaction([...])" => Unit of Work: o se aplica todo o nada
    await this.prisma.$transaction([
      this.prisma.session.updateMany({ where: { userId: id }, data: { isRevoked: true } }),
      this.prisma.oAuthAccount.deleteMany({ where: { userId: id } }),
      this.prisma.address.deleteMany({ where: { userId: id } }),
      this.prisma.pushToken.deleteMany({ where: { userId: id } }),
      this.prisma.user.update({
        where: { id },
        data: {
          email: `deleted-${id}@anonymized.invalid`, // Dominio reservado ".invalid" (RFC 2606): nunca recibe correo
          firstName: "Usuario",
          lastName: "eliminado",
          phone: null,
          avatarUrl: null,
          passwordHash: null,
          walletAddress: null,
          twoFactorEnabled: false,
          isActive: false,
          deletedAt: new Date(),
        },
      }),
    ]);
  }

  // deactivateMany => "desactivar usuarios por criterio masivo"; nunca incluye administradores
  public async deactivateMany(criteria: BulkDeactivationCriteria): Promise<number> {
    const where: Prisma.UserWhereInput = {
      isActive: true,
      roles: { none: { role: { name: "ADMIN" } } }, // "none" => usuarios SIN el rol ADMIN
      ...(criteria.ids ? { id: { in: criteria.ids } } : { updatedAt: { lt: criteria.inactiveSince } }),
    };
    const [result] = await this.prisma.$transaction([
      this.prisma.user.updateMany({ where, data: { isActive: false } }),
      // Las sesiones de los usuarios afectados quedan revocadas en la misma transacción
      this.prisma.session.updateMany({ where: { user: where, isRevoked: false }, data: { isRevoked: true } }),
    ]);
    return result.count; // Cantidad de usuarios desactivados
  }

  // setRoles => reemplaza los roles del usuario por la lista recibida (asignación dinámica, sprint 1.2)
  public async setRoles(userId: string, roleNames: string[]): Promise<string[]> {
    const roles = await this.prisma.role.findMany({ where: { name: { in: roleNames } }, select: { id: true, name: true } });
    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({ where: { userId } }),
      this.prisma.userRole.createMany({ data: roles.map((role) => ({ userId, roleId: role.id })) }),
      // Los JWT emitidos llevan los roles viejos: se revocan las sesiones para forzar un token nuevo
      this.prisma.session.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } }),
    ]);
    return roles.map((role) => role.name); // Solo los roles que realmente existen
  }

  // --- Lista de deseos (Account hub > Wishlist) ---

  // wishlistProductIds => IDs en orden de agregado (más reciente primero)
  public async wishlistProductIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: { productId: true } });
    return rows.map((row) => row.productId);
  }

  // addToWishlist => idempotente (PK compuesta userId+productId: agregar dos veces no duplica)
  public async addToWishlist(userId: string, productId: string): Promise<void> {
    await this.prisma.wishlistItem.upsert({ where: { userId_productId: { userId, productId } }, update: {}, create: { userId, productId } });
  }

  public async removeFromWishlist(userId: string, productId: string): Promise<void> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
  }

  // --- Direcciones ---

  public async createAddress(userId: string, input: AddressInput): Promise<AddressShape> {
    return this.prisma.$transaction(async (tx) => {
      // Regla: solo una dirección por defecto; la primera dirección siempre es la de por defecto
      const count = await tx.address.count({ where: { userId } });
      const isDefault = input.isDefault || count === 0;
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({
        data: { ...input, label: input.label ?? null, line2: input.line2 ?? null, isDefault, userId },
        select: ADDRESS_SELECT,
      });
    });
  }

  public async updateAddress(userId: string, addressId: string, input: UpdateAddressInput): Promise<AddressShape | null> {
    return this.prisma.$transaction(async (tx) => {
      // "findFirst" con userId => ownership: nunca se edita la dirección de otro usuario
      const existing = await tx.address.findFirst({ where: { id: addressId, userId } });
      if (!existing) return null;
      if (input.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      const data = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined)
      ) as Prisma.AddressUpdateInput;
      return tx.address.update({ where: { id: addressId }, data, select: ADDRESS_SELECT });
    });
  }

  public async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    // "deleteMany" con filtro de dueño => devuelve count (0 si no existe o no le pertenece)
    const result = await this.prisma.address.deleteMany({ where: { id: addressId, userId } });
    return result.count > 0;
  }

  private mapToEntity(row: ProfileRow): UserProfileEntity {
    return new UserProfileEntity({
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      avatarUrl: row.avatarUrl,
      phone: row.phone,
      phoneVerifiedAt: row.phoneVerifiedAt,
      birthDate: row.birthDate,
      isActive: row.isActive,
      isVerified: row.isVerified,
      twoFactorEnabled: row.twoFactorEnabled,
      walletAddress: row.walletAddress,
      locale: isLocale(row.locale) ? row.locale : "es",
      roles: row.roles.map((userRole) => userRole.role.name),
      // Proyección explícita: no se exponen userId ni timestamps de la dirección
      addresses: row.addresses.map(({ userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...address }) => address),
      createdAt: row.createdAt,
    });
  }
}

export const userRepository = new UserRepository(prisma);
