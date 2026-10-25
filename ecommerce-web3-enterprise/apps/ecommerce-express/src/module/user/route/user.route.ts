// user.route.ts => enrutamiento del módulo User; TODOS los endpoints requieren autenticación.
// RBAC granular (sprint 1.2): las operaciones de plataforma usan requirePermission("ACCIÓN", "user");
// las operaciones sobre un perfil concreto usan SelfOrAdminGuard (dueño del recurso o ADMIN).
import { Router } from "express";
import { userController } from "../controller/user.controller";
import { jwtAuthGuard } from "../../auth/guard/auth.guard";
import { SelfOrAdminGuard } from "../guard/user.guard";
import { requirePermission } from "../../../shared/middleware/rbac.middleware";

export const userRouter = Router();

// Todas las rutas del router exigen JWT válido (se declara una vez: DRY)
userRouter.use(jwtAuthGuard);

// GET /api/v1/user => listar TODOS los usuarios (dato sensible a nivel de plataforma)
userRouter.get("/", requirePermission("READ", "user"), userController.listUsers);

// DELETE /api/v1/user => desactivación masiva por criterio
userRouter.delete("/", requirePermission("DELETE", "user"), userController.deleteAllUsers);

// GET /api/v1/user/:id => el dueño del perfil o un ADMIN pueden ver el detalle (con direcciones)
userRouter.get("/:id", SelfOrAdminGuard, userController.getUserById);

// PATCH /api/v1/user/:id => el dueño del perfil o un ADMIN pueden actualizar campos parciales
userRouter.patch("/:id", SelfOrAdminGuard, userController.updateUser);

// PATCH /api/v1/user/:id/password => SOLO el dueño cambia su contraseña (exige la actual: un admin no la conoce)
userRouter.patch("/:id/password", SelfOrAdminGuard, userController.changePassword);

// PATCH /api/v1/user/:id/roles => asignación dinámica de roles (permiso UPDATE:role)
userRouter.patch("/:id/roles", requirePermission("UPDATE", "role"), userController.assignRoles);

// GET /api/v1/user/:id/export => el dueño (o un ADMIN que atiende la solicitud) descarga la copia de datos (RF-02.6)
userRouter.get("/:id/export", SelfOrAdminGuard, userController.exportUserData);

// DELETE /api/v1/user/:id => el dueño o un ADMIN pueden eliminar la cuenta (GDPR: anonimización)
userRouter.delete("/:id", SelfOrAdminGuard, userController.deleteUserById);

// Lista de deseos del usuario
userRouter.get("/:id/wishlist", SelfOrAdminGuard, userController.listWishlist);
userRouter.post("/:id/wishlist", SelfOrAdminGuard, userController.addToWishlist);
userRouter.delete("/:id/wishlist/:productId", SelfOrAdminGuard, userController.removeFromWishlist);

// Libreta de direcciones del usuario
userRouter.get("/:id/addresses", SelfOrAdminGuard, userController.listAddresses);
userRouter.post("/:id/addresses", SelfOrAdminGuard, userController.createAddress);
userRouter.patch("/:id/addresses/:addressId", SelfOrAdminGuard, userController.updateAddress);
userRouter.delete("/:id/addresses/:addressId", SelfOrAdminGuard, userController.deleteAddress);
