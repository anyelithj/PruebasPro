// supplier.service.ts => proveedores (sprint 7.2): onboarding con NIT único, condiciones comerciales, contrato con
// alerta de renovación, ranking por evaluación y desactivación (nunca borrado físico: conserva el historial).
// Patrones: Repository + Decorator (toDto agrega datos derivados sin tocar la entidad).
import type { Prisma } from "@prisma/client";
import { supplierRepository, type SupplierRepository } from "../repository/supplier.repository";
import { CONTRACT_ALERT_DAYS, contractDaysLeft, type Supplier } from "../model/supplier.model";
import { SupplierNotFoundException, SupplierTaxIdTakenException } from "../exception/supplier.exception";
import type { SupplierDto } from "../dto/supplier.dto";
import type { ListSuppliersQuery, SupplierInput, UpdateSupplierInput } from "../schema/supplier.schema";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";

// toDto => entidad + alerta de contrato (función pura)
function toDto(supplier: Supplier): SupplierDto {
  const daysLeft = contractDaysLeft(supplier.contractEndsAt);
  return { ...supplier, contractDaysLeft: daysLeft, contractAlert: daysLeft !== null && daysLeft <= CONTRACT_ALERT_DAYS };
}

// definedOnly => quita las claves "undefined" (exactOptionalPropertyTypes: Prisma distingue "ausente" de "undefined")
const definedOnly = (value: object) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

export class SupplierService {
  constructor(private readonly repository: SupplierRepository) {}

  // createSupplier => "registrar proveedor con datos y contrato"
  public async createSupplier(input: SupplierInput): Promise<SupplierDto> {
    if (await this.repository.findByTaxId(input.taxId)) throw new SupplierTaxIdTakenException();
    return toDto(await this.repository.create(definedOnly(input) as Prisma.SupplierCreateInput));
  }

  // listSuppliers => "proveedores activos con condiciones" (por defecto solo activos)
  public async listSuppliers(query: ListSuppliersQuery): Promise<{ items: SupplierDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany({ q: query.q, active: query.active ?? true }, page);
    return { items: items.map(toDto), meta: buildPaginationMeta(page, total) };
  }

  // getSupplierById => "perfil completo del proveedor por ID"
  public async getSupplierById(id: string): Promise<SupplierDto> {
    return toDto(await this.find(id));
  }

  // updateSupplier => "actualizar condiciones y datos del proveedor — PATCH parcial"
  public async updateSupplier(id: string, input: UpdateSupplierInput): Promise<SupplierDto> {
    const current = await this.find(id);
    if (input.taxId && input.taxId !== current.taxId && (await this.repository.findByTaxId(input.taxId))) throw new SupplierTaxIdTakenException();
    return toDto(await this.repository.update(id, definedOnly(input) as Prisma.SupplierUpdateInput));
  }

  // deleteSupplierById => "desactivar proveedor" (soft delete)
  public async deleteSupplierById(id: string): Promise<SupplierDto> {
    await this.find(id);
    return toDto(await this.repository.update(id, { isActive: false }));
  }

  private async find(id: string): Promise<Supplier> {
    const supplier = await this.repository.findById(id);
    if (!supplier) throw new SupplierNotFoundException(id);
    return supplier;
  }
}

export const supplierService = new SupplierService(supplierRepository);
