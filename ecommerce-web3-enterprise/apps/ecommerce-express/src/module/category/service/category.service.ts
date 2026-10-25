// category.service.ts => casos de uso de Category: árbol completo, detalle con breadcrumb, CRUD con reglas de jerarquía.
import { categoryRepository, type CategoryRepository } from "../repository/category.repository";
import { buildBreadcrumb, buildCategoryTree, collectDescendantIds } from "../model/category.model";
import { CategoryCycleException, CategoryNotFoundException } from "../exception/category.exception";
import type { CategoryDetailDto, CategoryDto, CategoryTreeDto } from "../dto/category.dto";
import type { CreateCategoryInput, UpdateCategoryInput } from "../schema/category.schema";
import { slugify, uniqueSlug } from "../../../shared/util/slugify.util";
import { cached, invalidateCatalog } from "../../../shared/interceptor/cache.interceptor";
import { RedisKeys } from "../../../config/redis.config";
import { isUuid } from "../../../shared/pipe/validation.pipe";

const CATEGORY_CACHE_TTL = 300; // 5 min: el árbol cambia poco y se consulta en cada página (menú)

export class CategoryService {
  constructor(private readonly repository: CategoryRepository) {}

  // listCategories => "listar categorías con árbol completo" (cacheado en Redis: Cache-Aside)
  public async listCategories(includeInactive = false): Promise<CategoryTreeDto[]> {
    const key = RedisKeys.catalog("category", includeInactive ? "tree:all" : "tree");
    return cached(key, CATEGORY_CACHE_TTL, async () => buildCategoryTree(await this.repository.findAll(includeInactive)));
  }

  // getCategoryById => "categoría con subcategorías por ID" (+ breadcrumb)
  public async getCategoryById(idOrSlug: string): Promise<CategoryDetailDto> {
    const category = await this.repository.findByIdOrSlug(idOrSlug, isUuid(idOrSlug));
    if (!category) throw new CategoryNotFoundException(idOrSlug);

    const all = await this.repository.findAll(false);
    // Se arma el árbol completo y se ubica el nodo: sus "children" traen hijos y nietos (Composite)
    const node = findNode(buildCategoryTree(all), category.id);
    const breadcrumb = buildBreadcrumb(all, category.id).map(({ id, name, slug }) => ({ id, name, slug }));
    return { ...category, children: node?.children ?? [], breadcrumb };
  }

  // descendantIds => usado por ProductService para filtrar "Ropa" incluyendo todas sus subcategorías
  public async descendantIds(idOrSlug: string): Promise<string[]> {
    const category = await this.repository.findByIdOrSlug(idOrSlug, isUuid(idOrSlug));
    if (!category) throw new CategoryNotFoundException(idOrSlug);
    return [...collectDescendantIds(await this.repository.findAll(false), category.id)];
  }

  // createCategory => "crear categoría o subcategoría"
  public async createCategory(input: CreateCategoryInput): Promise<CategoryDto> {
    if (input.parentId) await this.ensureExists(input.parentId);
    const slug = await this.resolveSlug(input.slug ?? slugify(input.name));
    const created = await this.repository.create({
      name: input.name,
      slug,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      parentId: input.parentId ?? null,
      position: input.position,
      isActive: input.isActive,
    });
    await this.invalidateCache();
    return created;
  }

  // updateCategory => "actualizar nombre, imagen o jerarquía — PATCH parcial"
  public async updateCategory(id: string, input: UpdateCategoryInput): Promise<CategoryDto> {
    await this.ensureExists(id);

    if (input.parentId) {
      // Regla del Composite: el nuevo padre no puede ser la propia categoría ni un descendiente (evita ciclos)
      const branch = collectDescendantIds(await this.repository.findAll(true), id);
      if (branch.has(input.parentId)) throw new CategoryCycleException();
      await this.ensureExists(input.parentId);
    }

    // Spread condicional por campo: solo se actualiza lo que llegó (semántica PATCH)
    const updated = await this.repository.update(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: await this.resolveSlug(input.slug, id) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    });
    await this.invalidateCache();
    return updated;
  }

  // deleteCategoryById => "eliminar y reasignar productos" (a la categoría indicada o al padre)
  public async deleteCategoryById(id: string, reassignTo?: string): Promise<void> {
    const category = await this.ensureExists(id);
    if (reassignTo) {
      const branch = collectDescendantIds(await this.repository.findAll(true), id);
      if (branch.has(reassignTo)) throw new CategoryCycleException(); // No se reasigna a la rama que se elimina
      await this.ensureExists(reassignTo);
    }
    await this.repository.softDeleteAndReassign(id, reassignTo ?? category.parentId);
    await this.invalidateCache();
  }

  private async ensureExists(id: string): Promise<CategoryDto> {
    const category = await this.repository.findByIdOrSlug(id, true);
    if (!category) throw new CategoryNotFoundException(id);
    return category;
  }

  // resolveSlug => usa el slug pedido si está libre; si no, agrega un sufijo aleatorio (sin romper el UNIQUE)
  private async resolveSlug(slug: string, currentId?: string): Promise<string> {
    const existing = await this.repository.findByIdOrSlug(slug, false);
    return existing && existing.id !== currentId ? uniqueSlug(slug) : slug;
  }

  private async invalidateCache(): Promise<void> {
    // También los listados de productos: dependen de la jerarquía para filtrar por categoría
    await invalidateCatalog("category", "product");
  }
}

// findNode => búsqueda en profundidad (DFS) de un nodo dentro del bosque (recursión sobre el Composite)
function findNode(nodes: CategoryTreeDto[], id: string): CategoryTreeDto | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return undefined;
}

export const categoryService = new CategoryService(categoryRepository);
