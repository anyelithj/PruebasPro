// user.service.ts => lógica de negocio del módulo User: perfil, contraseña, GDPR, roles y direcciones
import { userRepository, type UserRepository } from "../repository/user.repository";
import { userValidator, type UserValidator } from "../validator/user.validator";
import { comparePassword, hashPassword } from "../../auth/util/token.util"; // Reutiliza utilidades de Auth (DRY)
import { authEvents } from "../../auth/service/auth.service";
import type { AddressDto, UpdateProfileDto, UserDataExportDto, UserDetailDto, UserListItemDto } from "../dto/user.dto";
import type { AddressInput, ListUsersQuery, UpdateAddressInput } from "../schema/user.schema";
import type { BulkDeactivationCriteria } from "../types/user.types";
import {
  AccountAlreadyDeactivatedException,
  AddressNotFoundException,
  InvalidCurrentPasswordException,
  InvalidPhoneFormatException,
  SelfLockoutException,
  UserNotFoundException,
} from "../exception/user.exception";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { BadRequestException, NotFoundException } from "../../../shared/filter/http-exception.filter";
import { productRepository } from "../../product/repository/product.repository";
import type { ProductListItemDto } from "../../product/dto/product.dto";
import { Roles } from "../../../shared/constants/roles.constants";

export class UserService {
  // Inyección por constructor (DIP): repository y validator son reemplazables por dobles de prueba
  constructor(
    private readonly repository: UserRepository,
    private readonly validator: UserValidator
  ) {}

  // listUsers => caso de uso "listar usuarios con paginación y filtros"
  public async listUsers(query: ListUsersQuery): Promise<{ items: UserListItemDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.listUsers(
      { q: query.q, role: query.role, isActive: query.isActive },
      page
    );
    return { items: items.map((entity) => entity.toListItemJSON()), meta: buildPaginationMeta(page, total) };
  }

  // getUserById => caso de uso "perfil completo por ID con direcciones"
  public async getUserById(id: string): Promise<UserDetailDto> {
    const user = await this.repository.findById(id);
    // Guard clause: lanza temprano, evita continuar con un "user" potencialmente null más abajo
    if (!user) throw new UserNotFoundException(id);
    return user.toDetailJSON();
  }

  // updateUser => caso de uso "actualizar campos parciales del perfil"
  public async updateUser(id: string, changes: UpdateProfileDto): Promise<UserDetailDto> {
    const user = await this.repository.findById(id);
    if (!user) throw new UserNotFoundException(id);

    // Validación de negocio explícita además del regex de Zod (defensa en profundidad)
    if (changes.phone && !this.validator.isColombianPhoneFormat(changes.phone)) {
      throw new InvalidPhoneFormatException();
    }

    // RF-01.1: un teléfono NUEVO no está verificado => se anula la verificación anterior (debe confirmarse otra vez)
    const phoneChanged = changes.phone !== undefined && changes.phone !== user.phone;
    const updatedUser = await this.repository.updateProfile(id, { ...changes, ...(phoneChanged ? { phoneVerifiedAt: null } : {}) });
    return updatedUser.toDetailJSON();
  }

  // exportUserData => RF-02.6 / RNF-20: copia de los datos personales (perfil + actividad) para descargar en JSON
  public async exportUserData(id: string): Promise<UserDataExportDto> {
    // "Promise.all" => perfil (entidad de dominio) y actividad (consulta de exportación) en paralelo
    const [user, data] = await Promise.all([this.repository.findById(id), this.repository.exportData(id)]);
    if (!user || !data) throw new UserNotFoundException(id);
    const { addresses, ...profile } = user.toDetailJSON(); // Desestructuración con "rest": separa direcciones del perfil
    return {
      exportedAt: new Date().toISOString(),
      profile,
      addresses,
      wishlist: data.wishlist.map((item) => ({ productId: item.product.id, name: item.product.name, slug: item.product.slug, addedAt: item.createdAt })),
      orders: data.orders,
      reviews: data.reviews.map(({ product, ...review }) => ({ ...review, productName: product.name })),
      loyalty: data.loyaltyAccount,
      // Sin claves técnicas (id/userId): solo las preferencias del titular
      notificationPreferences: data.notificationPrefs ? Object.fromEntries(Object.entries(data.notificationPrefs).filter(([key]) => !["id", "userId"].includes(key))) : null,
      linkedAccounts: data.oauthLinks.map((link) => ({ provider: link.provider, linkedAt: link.createdAt })),
      sessions: data.sessions,
    };
  }

  // changePassword => el dueño cambia SU contraseña; exige la actual (reautenticación)
  public async changePassword(id: string, currentPassword: string, newPassword: string): Promise<void> {
    const currentHash = await this.repository.findPasswordHash(id);
    // Cuentas solo-OAuth no tienen contraseña: deben usar "olvidé mi contraseña" para crear una
    if (!currentHash || !(await comparePassword(currentPassword, currentHash))) {
      throw new InvalidCurrentPasswordException();
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException("La nueva contraseña debe ser distinta a la actual", "PASSWORD_UNCHANGED");
    }

    const user = await this.repository.updateProfile(id, { passwordHash: await hashPassword(newPassword) });
    const detail = user.toDetailJSON();
    // Evento => el módulo de notificaciones avisa por email del cambio (alerta de seguridad)
    authEvents.emit("user.password-changed", { userId: id, email: detail.email, firstName: detail.firstName });
  }

  // deleteUserById => caso de uso "eliminar cuenta GDPR" (anonimización, nunca DELETE físico)
  public async deleteUserById(id: string, requesterId: string): Promise<void> {
    const user = await this.repository.findById(id);
    if (!user) throw new UserNotFoundException(id);
    if (!user.canBeDeactivated()) throw new AccountAlreadyDeactivatedException();
    // Un admin no puede borrarse a sí mismo por esta vía (evita dejar la plataforma sin administradores)
    if (id === requesterId && user.hasRole(Roles.ADMIN)) throw new SelfLockoutException("eliminar");

    await this.repository.anonymizeUser(id);
  }

  // deleteAllUsers => caso de uso "desactivar usuarios por criterio masivo" (solo ADMIN, nunca admins)
  public async deleteAllUsers(criteria: BulkDeactivationCriteria): Promise<{ deactivated: number }> {
    return { deactivated: await this.repository.deactivateMany(criteria) };
  }

  // assignRoles => "asignación dinámica de roles" (sprint 1.2)
  public async assignRoles(userId: string, roles: string[], requesterId: string): Promise<{ roles: string[] }> {
    const user = await this.repository.findById(userId);
    if (!user) throw new UserNotFoundException(userId);
    // Un admin no puede quitarse a sí mismo el rol ADMIN
    if (userId === requesterId && user.hasRole(Roles.ADMIN) && !roles.includes(Roles.ADMIN)) {
      throw new SelfLockoutException("quitar el rol ADMIN de");
    }

    const assigned = await this.repository.setRoles(userId, roles);
    if (assigned.length === 0) throw new BadRequestException("Ninguno de los roles indicados existe", "UNKNOWN_ROLES");
    return { roles: assigned };
  }

  // --- Lista de deseos ---

  // listWishlist => tarjetas de producto (mismo DTO del catálogo: DRY) en orden de agregado
  public async listWishlist(userId: string): Promise<ProductListItemDto[]> {
    return productRepository.findCardsByIds(await this.repository.wishlistProductIds(userId));
  }

  public async addToWishlist(userId: string, productId: string): Promise<ProductListItemDto[]> {
    // Solo productos publicados (findCardsByIds filtra ACTIVE): se valida antes de guardar
    const [card] = await productRepository.findCardsByIds([productId]);
    if (!card) throw new NotFoundException("Product", productId);
    await this.repository.addToWishlist(userId, productId);
    return this.listWishlist(userId);
  }

  public async removeFromWishlist(userId: string, productId: string): Promise<ProductListItemDto[]> {
    await this.repository.removeFromWishlist(userId, productId);
    return this.listWishlist(userId);
  }

  // --- Direcciones (libreta de envío) ---

  public async listAddresses(userId: string): Promise<AddressDto[]> {
    return (await this.getUserById(userId)).addresses;
  }

  public async createAddress(userId: string, input: AddressInput): Promise<AddressDto> {
    await this.getUserById(userId); // Verifica existencia (404 si no)
    return this.repository.createAddress(userId, input);
  }

  public async updateAddress(userId: string, addressId: string, input: UpdateAddressInput): Promise<AddressDto> {
    const updated = await this.repository.updateAddress(userId, addressId, input);
    if (!updated) throw new AddressNotFoundException(addressId);
    return updated;
  }

  public async deleteAddress(userId: string, addressId: string): Promise<void> {
    const deleted = await this.repository.deleteAddress(userId, addressId);
    if (!deleted) throw new AddressNotFoundException(addressId);
  }
}

export const userService = new UserService(userRepository, userValidator);
