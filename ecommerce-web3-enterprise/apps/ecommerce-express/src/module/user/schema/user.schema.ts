// user.schema.ts => reglas de validación runtime para el módulo User (perfil, direcciones, password, roles)
import { LOCALES } from "../../../shared/util/i18n.util";
import { z } from "zod";
import { PasswordRule } from "../../auth/schema/auth.schema"; // Reutiliza la regla de complejidad (DRY)
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { queryBoolean } from "../../../shared/pipe/transform.pipe";

// Regex de teléfono colombiano: opcional "+57", luego "3" (celulares), luego 9 dígitos más
const ColombianPhone = z.string().regex(/^(\+57)?3\d{9}$/, { message: "Formato de teléfono colombiano inválido" });

// UpdateProfileSchema => valida PATCH /api/v1/user/:id (todos los campos opcionales: es una actualización parcial)
export const UpdateProfileSchema = z.object({
  // ".optional()" en TODOS los campos => refleja semántica PATCH (solo se envían los campos que cambian)
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  // ".nullable()" => null borra el teléfono guardado (PATCH distingue "no cambiar" de "vaciar")
  phone: ColombianPhone.nullable().optional(),
  avatarUrl: z.string().url().optional(),
  // Idioma preferido: lo cambia el selector de idioma del frontend (emails y notificaciones lo usan)
  locale: z.enum(LOCALES).optional(),
  // RF-13.3 / RF-14.1 cumpleaños (cupón y puntos): fecha pasada y edad mínima de 13 años; null la borra
  birthDate: z.coerce
    .date()
    .refine((date) => date.getTime() < Date.now() - 13 * 365.25 * 86_400_000 && date.getFullYear() > 1900, { message: "Fecha de nacimiento inválida" })
    .nullable()
    .optional(),
});

// ListUsersQuerySchema => GET /api/v1/user (paginación + filtros)
// ".extend" => reutiliza el schema de paginación compartido y le agrega los filtros propios (composición)
export const ListUsersQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
  role: z.string().regex(/^[A-Z_]+$/).optional(),
  isActive: queryBoolean,
});

// AddressSchema => valida una dirección guardada del usuario (campos del modelo Address de Prisma)
export const AddressSchema = z.object({
  label: z.string().trim().max(40).optional(), // "Casa", "Oficina"
  recipientName: z.string().trim().min(1, { message: "El nombre de quien recibe es obligatorio" }),
  phone: z.string().trim().min(7, { message: "Teléfono de contacto inválido" }),
  line1: z.string().trim().min(3, { message: "La dirección es obligatoria" }),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  postalCode: z.string().trim().min(3),
  // ISO 3166-1 alpha-2 en mayúsculas ("co" => "CO")
  country: z.string().length(2).transform((value) => value.toUpperCase()),
  isDefault: z.boolean().default(false), // .default() => si no se envía, Zod le asigna "false" automáticamente
});

// UpdateAddressSchema => PATCH parcial de una dirección (".partial()" vuelve opcionales todos los campos)
export const UpdateAddressSchema = AddressSchema.partial();

// PasswordSchema => valida el cambio de contraseña autenticado (distinto del "reset" por email)
export const PasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Debes ingresar tu contraseña actual" }),
  newPassword: PasswordRule,
});

// AssignRolesSchema => PATCH /api/v1/user/:id/roles — "asignación dinámica de roles" (sprint 1.2)
export const AssignRolesSchema = z.object({
  roles: z.array(z.string().regex(/^[A-Z_]+$/)).min(1, { message: "El usuario debe conservar al menos un rol" }),
});

// BulkDeactivateSchema => DELETE /api/v1/user — o IDs explícitos o "inactivos desde" (exactamente uno de los dos)
export const BulkDeactivateSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }),
  z.object({ inactiveSince: z.coerce.date() }),
]);

// WishlistItemSchema => POST /api/v1/user/:id/wishlist
export const WishlistItemSchema = z.object({ productId: z.string().uuid() });

// "z.infer" deriva el tipo TypeScript directamente del schema (DRY)
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;
export type PasswordInput = z.infer<typeof PasswordSchema>;
