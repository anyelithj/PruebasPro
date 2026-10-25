// permission.route.ts => enrutamiento del módulo Permission; TODO requiere rol ADMIN
// (los permisos son la base del RBAC: solo el rol más alto puede definirlos/modificarlos)
import { Router } from "express";
import { permissionController } from "../controller/permission.controller";
import { jwtAuthGuard, requireRoles } from "../../auth/guard/auth.guard";

export const permissionRouter = Router();

permissionRouter.post(
  "/",
  jwtAuthGuard,
  requireRoles("ADMIN"),
  permissionController.createPermission.bind(permissionController)
);

// GET => cualquier autenticado puede LISTAR (ej. para armar el selector de permisos al crear un rol)
permissionRouter.get("/", jwtAuthGuard, permissionController.listPermissions.bind(permissionController));

permissionRouter.get("/:id", jwtAuthGuard, permissionController.getPermissionById.bind(permissionController));

permissionRouter.patch(
  "/:id",
  jwtAuthGuard,
  requireRoles("ADMIN"),
  permissionController.updatePermission.bind(permissionController)
);

permissionRouter.delete(
  "/:id",
  jwtAuthGuard,
  requireRoles("ADMIN"),
  permissionController.deletePermissionById.bind(permissionController)
);
