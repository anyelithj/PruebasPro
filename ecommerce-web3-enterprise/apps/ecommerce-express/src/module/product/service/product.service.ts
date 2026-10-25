// product.service.ts => casos de uso del catálogo de productos (Fase 2.1).
// Orquesta: resolución de filtros (categorías/marcas), visibilidad por rol, ownership del vendedor, cache.
import type { Prisma } from "@prisma/client";
import { productRepository, type ProductRepository } from "../repository/product.repository";
import { canManageProduct, isStaffViewer } from "../model/product.model";
import {
  DuplicateSkuException,
  ProductNotFoundException,
  ProductOwnershipException,
  ProductWithoutVariantsException,
} from "../exception/product.exception";
import type { ProductDetailDto, ProductListItemDto } from "../dto/product.dto";
import { ImportRowSchema, type BulkUpdateProductsInput, type CreateProductInput, type ExportProductsQuery, type ImportRow, type ListProductsQuery, type UpdateProductInput } from "../schema/product.schema";
import type { ImportResult, ProductFilter, ProductViewer } from "../types/product.types";
import { parseSpreadsheet, toCsv, toXlsx, type Cell } from "../../../shared/util/spreadsheet.util";
import { commerceEvents } from "../../order/event/order.event";
import { AppException } from "../../../shared/filter/http-exception.filter";
import { ZodError } from "zod";
import { categoryService } from "../../category/service/category.service";
import { brandService } from "../../brand/service/brand.service";
import { slugify, uniqueSlug } from "../../../shared/util/slugify.util";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import { cached, invalidateCatalog } from "../../../shared/interceptor/cache.interceptor";
import { isUuid } from "../../../shared/pipe/validation.pipe";
import { RedisKeys } from "../../../config/redis.config";
import { Roles } from "../../../shared/constants/roles.constants";

const PUBLIC_CACHE_TTL = 60; // 60 s: coherente con la revalidación ISR de 60 s del storefront (sprint 2.2)

// EXPORT_HEADERS => columnas de la hoja de importación/exportación (RF-04.3). Una fila = una variante; las columnas de
// producto se repiten en cada variante y se agrupan por "slug" al importar. "imageUrls" es informativa (solo exportación)
export const EXPORT_HEADERS = [
  "slug", "name", "description", "status", "currency", "category", "brand", "badges",
  "sku", "variantName", "attributes", "price", "compareAtPrice", "stock", "weightGrams", "isActive", "imageUrls",
] as const;

export class ProductService {
  constructor(private readonly repository: ProductRepository) {}

  // listProducts => "listar productos con filtros y paginación"
  public async listProducts(
    query: ListProductsQuery,
    viewer?: ProductViewer
  ): Promise<{ items: ProductListItemDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const filter = await this.resolveFilter(query, viewer);
    const load = async () => {
      const { items, total } = await this.repository.findMany(filter, page);
      return { items, meta: buildPaginationMeta(page, total) };
    };
    // Solo las consultas públicas se cachean (las del staff dependen del usuario y deben verse al instante)
    return isStaffViewer(viewer) ? load() : cached(RedisKeys.catalog("product", `list:${JSON.stringify(query)}`), PUBLIC_CACHE_TTL, load);
  }

  // getProductById => "producto con variantes e imágenes por ID" (o slug)
  public async getProductById(idOrSlug: string, viewer?: ProductViewer): Promise<ProductDetailDto> {
    const load = () => this.repository.findDetail(idOrSlug, isUuid(idOrSlug));
    const product = isStaffViewer(viewer)
      ? await load()
      : await cached(RedisKeys.catalog("product", `detail:${idOrSlug}`), PUBLIC_CACHE_TTL, load);

    // El público solo ve productos ACTIVE; el staff ve lo que puede gestionar
    const visible = product && (product.status === "ACTIVE" || (viewer !== undefined && canManageProduct(viewer, product.vendorId)));
    if (!product || !visible) throw new ProductNotFoundException(idOrSlug);

    // Las variantes inactivas solo interesan al staff (el público no puede comprarlas)
    return isStaffViewer(viewer) ? product : { ...product, variants: product.variants.filter((variant) => variant.isActive) };
  }

  // createProduct => "crear producto con datos y categorías"
  public async createProduct(input: CreateProductInput, viewer: ProductViewer): Promise<ProductDetailDto> {
    await this.assertSkusAvailable(input.variants.map((variant) => variant.sku));
    const baseSlug = input.slug ?? slugify(input.name);
    const id = await this.repository.create(
      {
        name: input.name,
        slug: (await this.repository.slugTaken(baseSlug)) ? uniqueSlug(baseSlug) : baseSlug,
        description: input.description,
        status: input.status,
        currency: input.currency,
        categoryId: input.categoryId ?? null,
        brandId: input.brandId ?? null,
        badges: input.badges, // RF-04.2
        preSaleUntil: input.preSaleUntil ?? null, // RF-14.4
        vendorId: viewer.id, // El creador es el vendedor dueño (ownership)
      },
      input.variants,
      input.images
    );
    await this.invalidateCache();
    return this.getProductById(id, viewer);
  }

  // updateProduct => "actualizar producto, stock, imágenes, precio — PATCH parcial"
  public async updateProduct(id: string, input: UpdateProductInput, viewer: ProductViewer): Promise<ProductDetailDto> {
    await this.assertCanManage(id, viewer);
    if (input.variants) await this.assertSkusAvailable(input.variants.map((variant) => variant.sku), id);

    const { variants, removeVariantSkus, images, slug, ...fields } = input;
    // "Record<string, unknown>" => objeto dinámico de cambios; se tipa como input de Prisma al enviarlo
    const changes: Record<string, unknown> = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    if (slug) changes["slug"] = (await this.repository.slugTaken(slug, id)) ? uniqueSlug(slug) : slug;
    if (input.status === "ARCHIVED") changes["archivedAt"] = new Date();

    const before = await this.repository.findDetail(id, true); // Foto previa: precio y stock (avisos RF-02.7)
    await this.repository.update(id, changes as Prisma.ProductUncheckedUpdateInput, variants, removeVariantSkus, images);

    // Regla: un producto publicado debe tener al menos una variante activa (se valida con el estado final)
    const detail = await this.repository.findDetail(id, true);
    if (detail?.status === "ACTIVE" && (await this.repository.countActiveVariants(id)) === 0) {
      await this.repository.update(id, { status: "DRAFT" }, undefined, undefined, undefined); // Compensación
      throw new ProductWithoutVariantsException();
    }
    await this.invalidateCache();
    if (before && detail) this.emitWishlistAlerts(before, detail);
    return this.getProductById(id, viewer);
  }

  // duplicateProduct => RF-04.3 "duplicar": copia como BORRADOR con SKUs nuevos (sufijo -C + base36 del instante),
  // stock 0 y la misma galería (mismas imágenes de Cloudinary). Pasa por createProduct: mismas validaciones (DRY)
  public async duplicateProduct(id: string, viewer: ProductViewer): Promise<ProductDetailDto> {
    await this.assertCanManage(id, viewer);
    const source = await this.repository.findDetail(id, true);
    if (!source) throw new ProductNotFoundException(id);
    const suffix = `-C${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const newSku = (sku: string) => `${sku.slice(0, 40 - suffix.length)}${suffix}`; // Respeta el máximo de 40
    const skuById = new Map(source.variants.map((variant) => [variant.id, newSku(variant.sku)]));
    return this.createProduct(
      {
        name: `${source.name} (copia)`.slice(0, 160),
        description: source.description,
        status: "DRAFT",
        currency: source.currency,
        categoryId: source.category?.id ?? null,
        brandId: source.brand?.id ?? null,
        badges: source.badges,
        variants: source.variants.map((variant) => ({
          sku: newSku(variant.sku), name: variant.name, attributes: variant.attributes, priceCents: variant.priceCents,
          compareAtPriceCents: variant.compareAtPriceCents, stock: 0, weightGrams: variant.weightGrams, isActive: variant.isActive,
        })),
        images: source.images.map((image) => ({
          url: image.url, publicId: image.publicId, alt: image.alt,
          ...(image.width ? { width: image.width } : {}), ...(image.height ? { height: image.height } : {}),
          ...(image.variantId && skuById.get(image.variantId) ? { variantSku: skuById.get(image.variantId) } : {}),
        })),
      },
      viewer
    );
  }

  // bulkUpdateProducts => RF-04.3 edición en lote (un VENDOR solo cambia los suyos)
  public async bulkUpdateProducts({ ids, changes }: BulkUpdateProductsInput, viewer: ProductViewer): Promise<{ updated: number }> {
    const data: Prisma.ProductUncheckedUpdateManyInput = {
      ...Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)),
      ...(changes.status === "ARCHIVED" ? { archivedAt: new Date() } : {}),
    };
    const updated = await this.repository.bulkUpdate(ids, data, viewer.roles.includes(Roles.ADMIN) ? undefined : viewer.id);
    await this.invalidateCache();
    return { updated };
  }

  // exportProducts => RF-04.3 hoja Excel o CSV con los productos filtrados (VENDOR: solo los suyos)
  public async exportProducts(query: ExportProductsQuery, viewer: ProductViewer): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const { format, ...listQuery } = query;
    const filter = await this.resolveFilter({ ...listQuery, page: 1, limit: 1 }, viewer);
    const scoped = viewer.roles.includes(Roles.ADMIN) ? filter : { ...filter, vendorId: viewer.id };
    const products = await this.repository.exportRows(scoped);
    // "flatMap" => producto con N variantes -> N filas; montos de centavos a unidades de moneda (legible en Excel)
    const rows: Array<Record<string, Cell>> = products.flatMap((product) =>
      product.variants.map((variant) => ({
        slug: product.slug, name: product.name, description: product.description, status: product.status, currency: product.currency,
        category: product.category?.slug, brand: product.brand?.slug, badges: product.badges.join("|"),
        sku: variant.sku, variantName: variant.name,
        attributes: Object.entries((variant.attributes ?? {}) as Record<string, string>).map(([key, value]) => `${key}=${value}`).join("; "),
        price: variant.priceCents / 100,
        compareAtPrice: variant.compareAtPriceCents === null ? null : variant.compareAtPriceCents / 100,
        stock: variant.stock, weightGrams: variant.weightGrams, isActive: variant.isActive,
        imageUrls: product.images.map((image) => image.url).join(" | "),
      }))
    );
    const date = new Date().toISOString().slice(0, 10);
    return format === "csv"
      ? { buffer: toCsv(EXPORT_HEADERS, rows), filename: `productos-${date}.csv`, contentType: "text/csv; charset=utf-8" }
      : { buffer: toXlsx(EXPORT_HEADERS, rows), filename: `productos-${date}.xlsx`, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
  }

  // importProducts => RF-04.3 carga masiva desde Excel/CSV. Agrupa filas por slug (producto) y por cada grupo:
  // si el slug existe y el usuario puede gestionarlo => ACTUALIZA (upsert de variantes por SKU; el stock de variantes
  // existentes NO se toca: se ajusta en Inventario, fuente auditable); si no existe => CREA. Los errores se reportan
  // por grupo con sus números de fila (la fila 1 es el encabezado) y no detienen el resto (procesamiento tolerante).
  public async importProducts(file: Buffer, viewer: ProductViewer): Promise<ImportResult> {
    const result: ImportResult = { created: 0, updated: 0, errors: [] };
    const groups = new Map<string, Array<{ row: number; data: ImportRow }>>(); // "Map" conserva el orden de inserción
    parseSpreadsheet(file).forEach((raw, index) => {
      const row = index + 2;
      const parsed = ImportRowSchema.safeParse(raw); // "safeParse" => no lanza: devuelve { success, data | error }
      if (!parsed.success) return void result.errors.push({ rows: [row], slug: raw["slug"] ?? "", message: describeError(parsed.error) });
      const key = slugify(parsed.data.slug ?? parsed.data.name); // Normaliza el slug de la hoja (minúsculas y guiones)
      groups.set(key, [...(groups.get(key) ?? []), { row, data: parsed.data }]);
    });

    for (const [slug, entries] of groups) {
      const [head] = entries;
      if (!head) continue;
      try {
        const product = head.data;
        const [categoryId, brandId] = await Promise.all([
          product.category ? categoryService.getCategoryById(product.category).then((category) => category.id) : null,
          product.brand ? brandService.getBrandById(product.brand).then((brand) => brand.id) : null,
        ]);
        const variants = entries.map(({ data }) => ({
          sku: data.sku, name: data.variantName, attributes: data.attributes, priceCents: Math.round(data.price * 100),
          compareAtPriceCents: data.compareAtPrice === null || data.compareAtPrice === undefined ? null : Math.round(data.compareAtPrice * 100),
          weightGrams: data.weightGrams ?? 0, isActive: data.isActive, stock: data.stock,
        }));
        const fields = { name: product.name, description: product.description, categoryId, brandId, badges: product.badges };
        const existing = await this.repository.findDetail(slug, false);
        if (existing) {
          // Variantes existentes: sin "stock" (lo gestiona Inventario); nuevas: el stock de la hoja (o 0)
          const known = new Set(existing.variants.map((variant) => variant.sku));
          await this.updateProduct(existing.id, { ...fields, status: product.status, variants: variants.map(({ stock, ...variant }) => ({ ...variant, ...(known.has(variant.sku.toUpperCase()) ? {} : { stock: stock ?? 0 }) })) }, viewer);
          result.updated++;
        } else {
          await this.createProduct({ ...fields, slug, status: product.status === "ARCHIVED" ? "DRAFT" : product.status, currency: product.currency, images: [], variants: variants.map((variant) => ({ ...variant, stock: variant.stock ?? 0 })) }, viewer);
          result.created++;
        }
      } catch (error) {
        result.errors.push({ rows: entries.map((entry) => entry.row), slug, message: describeError(error) });
      }
    }
    return result;
  }

  // emitWishlistAlerts => RF-02.7 compara antes/después de una edición: bajó el precio mínimo o volvió el stock.
  // Publica eventos (Observer): el módulo Notification decide a quién y por qué canal avisar
  private emitWishlistAlerts(before: ProductDetailDto, after: ProductDetailDto): void {
    if (after.status !== "ACTIVE") return;
    if (after.minPriceCents > 0 && after.minPriceCents < before.minPriceCents) {
      commerceEvents.emit("product.price-dropped", { productId: after.id, productName: after.name, slug: after.slug, oldCents: before.minPriceCents, newCents: after.minPriceCents, currency: after.currency });
    }
    if (!before.inStock && after.inStock) commerceEvents.emit("product.back-in-stock", { productId: after.id, productName: after.name, slug: after.slug });
  }

  // deleteProductById => "archivar producto del catálogo"
  public async deleteProductById(id: string, viewer: ProductViewer): Promise<void> {
    await this.assertCanManage(id, viewer);
    await this.repository.archive([id]);
    await this.invalidateCache();
  }

  // deleteAllProducts => "archivar lote de productos" (un VENDOR solo archiva los suyos)
  public async deleteAllProducts(ids: string[], viewer: ProductViewer): Promise<{ archived: number }> {
    const vendorScope = viewer.roles.includes(Roles.ADMIN) ? undefined : viewer.id;
    const archived = await this.repository.archive(ids, vendorScope);
    await this.invalidateCache();
    return { archived };
  }

  // updateRating => expuesto para el módulo Review (el agregado se mantiene en un solo lugar)
  public async refreshRating(productId: string): Promise<void> {
    await this.repository.updateRating(productId);
    await this.invalidateCache();
  }

  // resolveFilter => slugs -> IDs, categoría -> rama completa, visibilidad por rol (el repository recibe IDs)
  private async resolveFilter(query: ListProductsQuery, viewer?: ProductViewer): Promise<ProductFilter> {
    const staff = isStaffViewer(viewer);
    const isAdmin = viewer?.roles.includes(Roles.ADMIN) ?? false;
    return {
      q: query.q,
      categoryIds: query.category ? await categoryService.descendantIds(query.category) : undefined,
      brandId: query.brand ? (await brandService.getBrandById(query.brand)).id : undefined,
      collectionSlug: query.collection,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      inStock: query.inStock,
      badge: query.badge,
      // Público: solo ACTIVE. Staff: el estado pedido (o todos). VENDOR: además restringido a lo suyo si no es ACTIVE
      statuses: staff ? (query.status ? [query.status] : ["DRAFT", "ACTIVE", "ARCHIVED"]) : ["ACTIVE"],
      vendorId: staff && !isAdmin && query.status !== "ACTIVE" ? viewer.id : undefined,
      sort: query.sort,
    };
  }

  private async assertCanManage(id: string, viewer: ProductViewer): Promise<void> {
    const ownership = await this.repository.findOwnership(id);
    if (!ownership) throw new ProductNotFoundException(id);
    if (!canManageProduct(viewer, ownership.vendorId)) throw new ProductOwnershipException();
  }

  private async assertSkusAvailable(skus: string[], productId?: string): Promise<void> {
    const conflicts = await this.repository.findSkusOwnedByOthers(skus, productId);
    if (conflicts.length > 0) throw new DuplicateSkuException(conflicts);
  }

  private async invalidateCache(): Promise<void> {
    // Los conteos de productos por marca/categoría/colección también cambian
    await invalidateCatalog("product", "brand", "category", "collection");
  }
}

// describeError => mensaje legible para el reporte de importación (Zod: "campo: motivo"; excepciones propias: su texto)
function describeError(error: unknown): string {
  if (error instanceof ZodError) return error.issues.map((issue) => `${issue.path.join(".") || "fila"}: ${issue.message}`).join("; ");
  if (error instanceof AppException) return error.message;
  return "Error inesperado al guardar";
}

export const productService = new ProductService(productRepository);
