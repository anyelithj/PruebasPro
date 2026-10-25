// category.repository.ts => acceso a datos de categorías (patrón Repository sobre Prisma).
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../../config/database.config";
import type { CategoryDto } from "../dto/category.dto";

// Select + conteo de productos activos (para mostrar "Camisetas (24)" en la UI)
const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  parentId: true,
  position: true,
  isActive: true,
  _count: { select: { products: { where: { status: "ACTIVE" } } } },
} satisfies Prisma.CategorySelect;

type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof CATEGORY_SELECT }>;

export class CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // findAll => lista plana (el árbol se arma en memoria: una sola query)
  public async findAll(includeInactive: boolean): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
      select: CATEGORY_SELECT,
    });
    return rows.map(toDto);
  }

  public async findByIdOrSlug(idOrSlug: string, isUuid: boolean): Promise<CategoryDto | null> {
    const row = await this.prisma.category.findFirst({
      where: { deletedAt: null, ...(isUuid ? { id: idOrSlug } : { slug: idOrSlug }) },
      select: CATEGORY_SELECT,
    });
    return row ? toDto(row) : null;
  }

  public async slugExists(slug: string): Promise<boolean> {
    return (await this.prisma.category.count({ where: { slug } })) > 0;
  }

  public async create(data: Prisma.CategoryUncheckedCreateInput): Promise<CategoryDto> {
    return toDto(await this.prisma.category.create({ data, select: CATEGORY_SELECT }));
  }

  public async update(id: string, data: Prisma.CategoryUncheckedUpdateInput): Promise<CategoryDto> {
    return toDto(await this.prisma.category.update({ where: { id }, data, select: CATEGORY_SELECT }));
  }

  // softDeleteAndReassign => "eliminar y reasignar productos" en UNA transacción (Unit of Work):
  // los productos y subcategorías pasan a "targetId" (o quedan sin categoría / como raíz si es null)
  public async softDeleteAndReassign(id: string, targetId: string | null): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: targetId } }),
      this.prisma.category.updateMany({ where: { parentId: id }, data: { parentId: targetId } }),
      // El slug se libera con un sufijo para poder reutilizarlo en una categoría nueva
      this.prisma.category.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false, slug: `${id}-deleted`, parentId: null },
      }),
    ]);
  }
}

// toDto => mapeo fila Prisma -> DTO (función pura, fuera de la clase: no necesita estado)
function toDto(row: CategoryRow): CategoryDto {
  const { _count, ...rest } = row; // Desestructuración con "rest": separa el conteo del resto de campos
  return { ...rest, productCount: _count.products };
}

export const categoryRepository = new CategoryRepository(prisma);
