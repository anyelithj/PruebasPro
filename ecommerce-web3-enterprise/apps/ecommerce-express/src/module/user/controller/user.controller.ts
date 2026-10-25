// user.controller.ts => capa HTTP del módulo User: parsea query/params/body y delega al Service
// asyncHandler (shared/interceptor) reemplaza el try/catch repetido en cada handler (DRY).
import type { Request, Response } from "express";
import { userService } from "../service/user.service";
import {
  AddressSchema,
  AssignRolesSchema,
  BulkDeactivateSchema,
  ListUsersQuerySchema,
  PasswordSchema,
  UpdateAddressSchema,
  UpdateProfileSchema,
  WishlistItemSchema,
} from "../schema/user.schema";
import { asyncHandler, sendNoContent, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { parseId } from "../../../shared/pipe/validation.pipe";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class UserController {
  // listUsers => GET /api/v1/user?page=1&limit=20&q=&role=&isActive=
  public readonly listUsers = asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await userService.listUsers(ListUsersQuerySchema.parse(req.query));
    sendSuccess(res, items, HttpStatus.OK, meta); // "meta" => paginación para el frontend
  });

  // getUserById => GET /api/v1/user/:id
  public readonly getUserById = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await userService.getUserById(parseId(req)));
  });

  // updateUser => PATCH /api/v1/user/:id
  public readonly updateUser = asyncHandler(async (req: Request, res: Response) => {
    const changes = UpdateProfileSchema.parse(req.body);
    sendSuccess(res, await userService.updateUser(parseId(req), changes));
  });

  // changePassword => PATCH /api/v1/user/:id/password
  public readonly changePassword = asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = PasswordSchema.parse(req.body);
    await userService.changePassword(parseId(req), currentPassword, newPassword);
    sendSuccess(res, { message: "Contraseña actualizada correctamente." });
  });

  // assignRoles => PATCH /api/v1/user/:id/roles
  public readonly assignRoles = asyncHandler(async (req: Request, res: Response) => {
    const { roles } = AssignRolesSchema.parse(req.body);
    sendSuccess(res, await userService.assignRoles(parseId(req), roles, currentUser(req).id));
  });

  // exportUserData => GET /api/v1/user/:id/export (RF-02.6 GDPR portabilidad). "Content-Disposition: attachment" =>
  // el navegador lo guarda como archivo; "no-store" => la copia de datos personales nunca queda en cachés intermedias
  public readonly exportUserData = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req);
    res.setHeader("Content-Disposition", `attachment; filename="datos-personales-${id}.json"`);
    res.setHeader("Cache-Control", "no-store");
    sendSuccess(res, await userService.exportUserData(id));
  });

  // deleteUserById => DELETE /api/v1/user/:id (GDPR: anonimización)
  public readonly deleteUserById = asyncHandler(async (req: Request, res: Response) => {
    await userService.deleteUserById(parseId(req), currentUser(req).id);
    sendNoContent(res);
  });

  // deleteAllUsers => DELETE /api/v1/user (body: { ids } o { inactiveSince })
  public readonly deleteAllUsers = asyncHandler(async (req: Request, res: Response) => {
    const criteria = BulkDeactivateSchema.parse(req.body);
    // "in" => type guard de unión: distingue el criterio por IDs del criterio por fecha
    const result = await userService.deleteAllUsers(
      "ids" in criteria ? { ids: criteria.ids } : { inactiveSince: criteria.inactiveSince }
    );
    sendSuccess(res, result);
  });

  // --- Lista de deseos: /api/v1/user/:id/wishlist ---

  public readonly listWishlist = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await userService.listWishlist(parseId(req)));
  });

  public readonly addToWishlist = asyncHandler(async (req: Request, res: Response) => {
    const { productId } = WishlistItemSchema.parse(req.body);
    sendSuccess(res, await userService.addToWishlist(parseId(req), productId), HttpStatus.CREATED);
  });

  public readonly removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await userService.removeFromWishlist(parseId(req), parseId(req, "productId")));
  });

  // --- Direcciones: /api/v1/user/:id/addresses ---

  public readonly listAddresses = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await userService.listAddresses(parseId(req)));
  });

  public readonly createAddress = asyncHandler(async (req: Request, res: Response) => {
    const input = AddressSchema.parse(req.body);
    sendSuccess(res, await userService.createAddress(parseId(req), input), HttpStatus.CREATED);
  });

  public readonly updateAddress = asyncHandler(async (req: Request, res: Response) => {
    const input = UpdateAddressSchema.parse(req.body);
    sendSuccess(res, await userService.updateAddress(parseId(req), parseId(req, "addressId"), input));
  });

  public readonly deleteAddress = asyncHandler(async (req: Request, res: Response) => {
    await userService.deleteAddress(parseId(req), parseId(req, "addressId"));
    sendNoContent(res);
  });
}

export const userController = new UserController();
