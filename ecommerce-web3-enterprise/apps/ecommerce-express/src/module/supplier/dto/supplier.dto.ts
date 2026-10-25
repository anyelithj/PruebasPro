// supplier.dto.ts => contratos de salida del módulo Suppliers (CreateSupplierDto / UpdateSupplierDto son los
// tipos inferidos de supplier.schema.ts; aquí vive la forma que recibe el panel).
import type { Supplier } from "../model/supplier.model";

// SupplierDto => proveedor + alerta de contrato calculada (no se guarda: se deriva de contractEndsAt)
export interface SupplierDto extends Supplier {
  contractDaysLeft: number | null;
  contractAlert: boolean; // true => vence dentro de 30 días o ya venció
}
