// supplier.repository.ts => acceso a "suppliers" con Prisma (patrón Repository: el service no conoce el ORM).
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import type { Supplier } from "../model/supplier.model";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

export class SupplierRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  public create(data: Prisma.SupplierCreateInput): Promise<Supplier> {
    return this.db.supplier.create({ data });
  }

  // findMany => ranking de desempeño: mejor evaluación primero ("nulls: last" => sin evaluar al final)
  public async findMany(filters: { q?: string | undefined; active?: boolean | undefined }, page: PageParams): Promise<Paginated<Supplier>> {
    const where: Prisma.SupplierWhereInput = {
      ...(filters.active !== undefined ? { isActive: filters.active } : {}),
      // "mode: insensitive" => ILIKE de PostgreSQL (sin distinguir mayúsculas)
      ...(filters.q ? { OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { taxId: { contains: filters.q } }] } : {}),
    };
    // "$transaction([...])" => página y total en una sola ida a la base
    const [items, total] = await this.db.$transaction([
      this.db.supplier.findMany({ where, orderBy: [{ rating: { sort: "desc", nulls: "last" } }, { name: "asc" }], skip: page.skip, take: page.limit }),
      this.db.supplier.count({ where }),
    ]);
    return { items, total };
  }

  public findById(id: string): Promise<Supplier | null> {
    return this.db.supplier.findUnique({ where: { id } });
  }

  public findByTaxId(taxId: string): Promise<Supplier | null> {
    return this.db.supplier.findUnique({ where: { taxId } });
  }

  public update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
    return this.db.supplier.update({ where: { id }, data });
  }
}

export const supplierRepository = new SupplierRepository();
