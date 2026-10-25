// permission.schema.ts => validación runtime del módulo Permission
import { z } from "zod";

// ActionEnum => lista cerrada de acciones válidas, alineada a la taxonomía CRUD de la matriz de trazabilidad
export const ActionEnum = z.enum(["CREATE", "READ", "UPDATE", "DELETE"], {
  errorMap: () => ({ message: "Acción inválida: debe ser CREATE, READ, UPDATE o DELETE" }),
});

// PermissionSchema => valida POST /api/v1/permission
export const PermissionSchema = z.object({
  action: ActionEnum,
  // Recurso en minúscula-singular (ej. "product", "order") — convención del proyecto
  resource: z.string().regex(/^[a-z_]+$/, { message: "El recurso debe ser minúsculas_con_guion_bajo" }),
  description: z.string().optional(),
});

// UpdatePermissionSchema => solo permite editar la descripción (action/resource son inmutables tras crear,
// porque cambiarlos rompería referencias ya asignadas a roles — regla de integridad)
export const UpdatePermissionSchema = z.object({
  description: z.string().min(1),
});

export type PermissionInput = z.infer<typeof PermissionSchema>;
export type UpdatePermissionInput = z.infer<typeof UpdatePermissionSchema>;
