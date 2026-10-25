// collection.service.ts => casos de uso de Collection (curaduría temática de productos).
import { collectionRepository, type CollectionRepository } from "../repository/collection.repository";
import { CollectionNotFoundException } from "../exception/collection.exception";
import { isCollectionLive, lookDiscount } from "../model/collection.model";
import type { CollectionDetailDto, CollectionDto } from "../dto/collection.dto";
import type { CreateCollectionInput, UpdateCollectionInput } from "../schema/collection.schema";
import { slugify, uniqueSlug } from "../../../shared/util/slugify.util";
import { cached, invalidateCatalog } from "../../../shared/interceptor/cache.interceptor";
import { isUuid } from "../../../shared/pipe/validation.pipe";
import { RedisKeys } from "../../../config/redis.config";

export class CollectionService {
  constructor(private readonly repository: CollectionRepository) {}

  // listCollections => "listar colecciones activas con productos"
  public async listCollections(includeAll: boolean): Promise<CollectionDto[]> {
    return cached(RedisKeys.catalog("collection", includeAll ? "all" : "live"), 120, () =>
      this.repository.findMany(!includeAll)
    );
  }

  // getCollectionById => "colección con todos sus productos por ID" (el público solo ve colecciones vigentes)
  public async getCollectionById(idOrSlug: string, isStaffViewer: boolean): Promise<CollectionDetailDto> {
    const collection = await this.repository.findByIdOrSlug(idOrSlug, isUuid(idOrSlug));
    if (!collection || (!isStaffViewer && !isCollectionLive(collection))) throw new CollectionNotFoundException(idOrSlug);
    return { ...collection, products: await this.repository.findProducts(collection.id) };
  }

  // createCollection => "crear nueva colección temática"
  public async createCollection(input: CreateCollectionInput): Promise<CollectionDto> {
    const baseSlug = input.slug ?? slugify(input.name);
    const collection = await this.repository.save(
      null,
      {
        name: input.name,
        slug: (await this.repository.slugTaken(baseSlug)) ? uniqueSlug(baseSlug) : baseSlug,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        lookDiscountPercent: input.lookDiscountPercent ?? null,
        isActive: input.isActive ?? true,
      },
      input.productIds
    );
    await invalidateCatalog("collection");
    return collection;
  }

  // updateCollection => "actualizar nombre, imagen o productos incluidos — PATCH parcial"
  public async updateCollection(id: string, input: UpdateCollectionInput): Promise<CollectionDto> {
    const current = await this.repository.findByIdOrSlug(id, true);
    if (!current) throw new CollectionNotFoundException(id);
    const { productIds, slug, ...fields } = input; // "rest": separa lo que requiere tratamiento especial
    const data = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    const collection = await this.repository.save(
      id,
      {
        name: current.name, // Campo requerido por el tipo de creación; se sobreescribe si llega en "data"
        ...data,
        ...(slug ? { slug: (await this.repository.slugTaken(slug, id)) ? uniqueSlug(slug) : slug } : { slug: current.slug }),
      },
      productIds
    );
    await invalidateCatalog("collection");
    return collection;
  }

  // lookDiscountFor => RF-05.5 descuento por looks completos de un conjunto de ítems (lo usa el checkout).
  // Las reglas vigentes se cachean 60 s (Cache-Aside): el checkout no consulta colecciones en cada paso
  public async lookDiscountFor(items: ReadonlyArray<{ productId: string; unitPriceCents: number; quantity: number }>) {
    const looks = await cached(RedisKeys.catalog("collection", "looks"), 60, () => this.repository.findLiveLooks());
    return lookDiscount(items, looks);
  }

  // deleteCollectionById => "eliminar colección sin afectar productos"
  public async deleteCollectionById(id: string): Promise<void> {
    if (!(await this.repository.findByIdOrSlug(id, true))) throw new CollectionNotFoundException(id);
    await this.repository.softDelete(id);
    await invalidateCatalog("collection");
  }
}

export const collectionService = new CollectionService(collectionRepository);
