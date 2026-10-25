// permission.dto.ts => contratos de entrada/salida del módulo Permission
import type { PermissionInput, UpdatePermissionInput } from "../schema/permission.schema";

export type CreatePermissionDto = PermissionInput;
export type UpdatePermissionDto = UpdatePermissionInput;

export interface PermissionResponseDto {
  id: string;
  action: string;
  resource: string;
  description: string | null;
  createdAt: Date;
}
