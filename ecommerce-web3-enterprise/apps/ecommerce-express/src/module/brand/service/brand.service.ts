// brand.service.ts => casos de uso de Brand (listado con conteo, detalle con productos, CRUD con regla de borrado).
import { brandRepository, type BrandRepository } from "../repository/brand.repository";
import { BrandHasActiveProductsException, BrandNotFoundException } from "../exception/brand.exception";
import type { BrandDetailDto, BrandDto, BrandStatsDto } from "../dto/brand.dto";
import type { CreateBrandInput, ListBrandsQuery, UpdateBrandInput } from "../schema/brand.schema";
import type { BrandEntity } from "../model/brand.model";
import { slugify, uniqueSlug } from "../../../shared/util/slugify.util";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { cached, invalidateCatalog } from "../../../shared/interceptor/cache.interceptor";
import { isUuid } from "../../../shared/pipe/validation.pipe";
import { RedisKeys } from "../../../config/redis.config";
import { mediaService } from "../../media/service/media.service"; // service -> service (no se salta la capa del módulo Media)

const BRAND_PRODUCTS_PREVIEW = 24; // Productos mostrados en la página de marca

export class BrandService {
  constructor(private readonly repository: BrandRepository) {}

  // listBrands => "listar marcas con logo y conteo de productos" (cacheado: Cache-Aside)
  public async listBrands(query: ListBrandsQuery, includeInactive: boolean): Promise<{ items: BrandDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const key = RedisKeys.catalog("brand", JSON.stringify({ ...query, includeInactive }));
    return cached(key, 300, async () => {
      const { items, total } = await this.repository.findMany({ q: query.q, premium: query.premium, exclusive: query.exclusive }, !includeInactive, page);
      return { items: items.map((brand) => brand.toJSON()), meta: buildPaginationMeta(page, total) };
    });
  }

  // getBrandById => "marca con productos asociados por ID" (acepta slug para URLs SEO)
  public async getBrandById(idOrSlug: string): Promise<BrandDetailDto> {
    const brand = await this.findOrFail(idOrSlug);
    return { ...brand.toJSON(), products: await this.repository.findProducts(brand.id, BRAND_PRODUCTS_PREVIEW) };
  }

  public async createBrand(input: CreateBrandInput): Promise<BrandDto> {
    const baseSlug = input.slug ?? slugify(input.name);
    const slug = (await this.repository.slugTaken(baseSlug)) ? uniqueSlug(baseSlug) : baseSlug;
    const brand = await this.repository.create({
      name: input.name,
      slug,
      description: input.description ?? null,
      website: input.website ?? null,
      logoUrl: input.logoUrl ?? null,
      logoPublicId: input.logoPublicId ?? null,
      story: input.story ?? null,
      country: input.country ?? null,
      isPremium: input.isPremium,
      isExclusive: input.isExclusive,
      isActive: input.isActive,
    });
    await this.invalidateCache();
    return brand.toJSON();
  }

  public async updateBrand(id: string, input: UpdateBrandInput): Promise<BrandDto> {
    const current = await this.findOrFail(id);
    // "Object.fromEntries + filter" => solo los campos presentes (PATCH) y compatible con exactOptionalPropertyTypes
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    if (input.slug && (await this.repository.slugTaken(input.slug, id))) changes["slug"] = uniqueSlug(input.slug);

    const updated = await this.repository.update(id, changes);
    // Logo reemplazado => se borra el asset anterior de Cloudinary (evita basura y costo de almacenamiento)
    const oldLogo = current.currentLogoPublicId;
    if (input.logoPublicId && oldLogo && oldLogo !== input.logoPublicId) await mediaService.deleteImage(oldLogo);
    await this.invalidateCache();
    return updated.toJSON();
  }

  // getBrandStats => RF-05.4 estadísticas de ventas por marca (panel admin). Caché corta: son agregados costosos
  public async getBrandStats(idOrSlug: string): Promise<BrandStatsDto> {
    const brand = await this.findOrFail(idOrSlug);
    return cached(RedisKeys.catalog("brand", `stats:${brand.id}`), 120, async () => {
      const { totals, top, monthly } = await this.repository.salesStats(brand.id);
      return { brandId: brand.id, ...totals, topProducts: top, monthly };
    });
  }

  // deleteBrandById => "eliminar marca sin productos activos"
  public async deleteBrandById(id: string): Promise<void> {
    const brand = await this.findOrFail(id);
    if (!brand.canBeDeleted()) throw new BrandHasActiveProductsException(brand.activeProducts);
    await this.repository.softDelete(id);
    if (brand.currentLogoPublicId) await mediaService.deleteImage(brand.currentLogoPublicId);
    await this.invalidateCache();
  }

  private async findOrFail(idOrSlug: string): Promise<BrandEntity> {
    const brand = await this.repository.findByIdOrSlug(idOrSlug, isUuid(idOrSlug));
    if (!brand) throw new BrandNotFoundException(idOrSlug);
    return brand;
  }

  private async invalidateCache(): Promise<void> {
    await invalidateCatalog("brand", "product");
  }
}

export const brandService = new BrandService(brandRepository);
