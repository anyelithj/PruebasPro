// search.service.ts => búsqueda avanzada: texto con facetas, sugerencias, búsqueda visual e historial.
import axios from "axios";
import { searchRepository, type ResolvedSearchFilter, type SearchRepository } from "../repository/search.repository";
import { MissingImageException, VisionEngineUnavailableException } from "../exception/search.exception";
import type { ImageSearchResultDto, SearchResultDto, SuggestionDto, VisualAttributesDto } from "../dto/search.dto";
import { correctQuery, tokenize } from "../util/spelling.util";
import type { SearchQuery } from "../schema/search.schema";
import { productRepository } from "../../product/repository/product.repository";
import { categoryService } from "../../category/service/category.service";
import { brandService } from "../../brand/service/brand.service";
import { appConfig } from "../../../config/app.config";
import { RedisKeys } from "../../../config/redis.config";
import { cached } from "../../../shared/interceptor/cache.interceptor";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import { logger } from "../../../shared/middleware/logger.middleware";
import { signServiceToken } from "../../auth/util/token.util";

const IMAGE_RESULTS = 24; // Máximo que acepta el motor IA (MAX_SEARCH_RESULTS en FastAPI)
const VOCABULARY_TTL_SECONDS = 600; // El vocabulario cambia solo al publicar productos: 10 min de caché
const LOGO_CANDIDATES = 50; // Marcas que el motor compara como logo (CLIP zero-shot: costo lineal por candidata)
const BRAND_BOOST_SCORE = 0.5; // Confianza mínima del logo para subir esa marca al inicio del ranking

// Respuesta de POST /api/v1/ml/image-recognition/search (FastAPI): { success, data: { items, attributes } }
interface VisionSearchResponse {
  data: { items: Array<{ product_id: string; similarity: number }>; attributes?: VisualAttributesDto | null };
}

export class SearchService {
  constructor(private readonly repository: SearchRepository) {}

  // listSearchResults => "buscar productos con filtros y facetas"
  public async search(query: SearchQuery, userId?: string): Promise<SearchResultDto> {
    const page = toPageParams(query);
    const filter: ResolvedSearchFilter = {
      q: query.q,
      categoryIds: query.category ? await categoryService.descendantIds(query.category) : undefined,
      brandId: query.brand ? (await brandService.getBrandById(query.brand)).id : undefined,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      inStock: query.inStock,
      attributes: query.attr,
      sort: query.sort,
    };

    // Cache corta de resultados públicos (misma consulta => misma respuesta durante 60 s)
    const result = await cached(RedisKeys.catalog("search", JSON.stringify(query)), 60, async () => {
      // Resultados y facetas en paralelo: la latencia total es la de la consulta más lenta
      const [{ ids, total }, facets] = await Promise.all([this.repository.searchIds(filter, page), this.repository.facets(filter)]);
      // RF-06.1: sin resultados => se sugiere la consulta corregida con el vocabulario del catálogo
      const didYouMean = total === 0 ? await this.spelling(query.q) : null;
      return { query: query.q, didYouMean, items: await productRepository.findCardsByIds(ids), facets, meta: buildPaginationMeta(page, total) };
    });

    // Historial solo para usuarios autenticados; "fire-and-forget": un fallo de MongoDB no afecta la búsqueda
    if (userId) {
      this.repository
        .recordHistory({ userId, query: query.q, filters: { ...query, q: undefined }, resultsCount: result.meta.total, source: "TEXT" })
        .catch((error: unknown) => logger.warn("search_history_failed", { error }));
    }
    return result;
  }

  // suggestions => autocompletado (cache 5 min por prefijo)
  public async suggestions(q: string): Promise<SuggestionDto[]> {
    return cached(RedisKeys.catalog("suggest", q.toLowerCase()), 300, () => this.repository.suggestions(q));
  }

  // spelling => RF-06.1 "¿Quisiste decir…?": corrige cada palabra contra el vocabulario del catálogo (Levenshtein).
  // El vocabulario (palabra -> frecuencia) se arma una vez y se guarda en Redis como pares [palabra, frecuencia]
  public async spelling(q: string): Promise<string | null> {
    const pairs = await cached(RedisKeys.catalog("vocabulary", "all"), VOCABULARY_TTL_SECONDS, async () => {
      const frequency = new Map<string, number>();
      for (const name of await this.repository.vocabularyNames()) for (const word of tokenize(name)) frequency.set(word, (frequency.get(word) ?? 0) + 1);
      return [...frequency]; // Map -> arreglo de pares (JSON no serializa Map)
    });
    return correctQuery(q, new Map(pairs));
  }

  // createSearchResult => "búsqueda visual por imagen — genera consulta embedding"
  public async searchByImage(file: { buffer: Buffer; mimetype: string; originalname: string } | undefined, userId?: string): Promise<ImageSearchResultDto> {
    if (!file) throw new MissingImageException();

    // 1. El motor IA (FastAPI: CLIP + pgvector HNSW) devuelve los productos visualmente más parecidos.
    //    La imagen no se guarda en ningún lado: solo se usa en memoria para la consulta.
    let nearest: VisionSearchResponse["data"]["items"];
    let attributes: VisualAttributesDto | null = null;
    try {
      const form = new FormData(); // FormData/Blob nativos de Node 18+ (sin dependencias)
      form.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);
      form.append("k", String(IMAGE_RESULTS));
      // RF-06.4: marcas del catálogo como candidatas de logo (el motor responde cuáles reconoce en la foto)
      const brands = await this.repository.brandNames(LOGO_CANDIDATES);
      form.append("brands", JSON.stringify(brands.map((brand) => brand.name)));
      const { data } = await axios.post<VisionSearchResponse>(`${appConfig.FASTAPI_URL}/api/v1/ml/image-recognition/search`, form, {
        timeout: 15_000,
        headers: { Authorization: `Bearer ${signServiceToken()}` }, // Rol SERVICE (guard RBAC de FastAPI)
      });
      nearest = data.data.items;
      attributes = data.data.attributes ?? null;
    } catch {
      throw new VisionEngineUnavailableException();
    }

    // 2. Tarjetas de producto en el mismo orden del ranking (solo productos ACTIVE)
    const cards = await productRepository.findCardsByIds(nearest.map((row) => row.product_id));
    const similarity = new Map(nearest.map((row) => [row.product_id, row.similarity]));

    if (userId) {
      this.repository
        .recordHistory({ userId, query: "[imagen]", filters: {}, resultsCount: cards.length, source: "IMAGE" })
        .catch(() => undefined);
    }
    // RF-06.4: si el logo de una marca se reconoce con confianza, sus productos suben al inicio (orden estable)
    const logo = attributes?.brands[0];
    const boosted = logo && logo.score >= BRAND_BOOST_SCORE ? normalizeBrand(logo.label) : null;
    const items = cards.map((card) => ({ ...card, similarity: similarity.get(card.id) ?? 0 }));
    if (boosted) items.sort((a, b) => Number(normalizeBrand(b.brand?.name ?? "") === boosted) - Number(normalizeBrand(a.brand?.name ?? "") === boosted));
    return { items, attributes };
  }

  public async recentSearches(userId: string): Promise<string[]> {
    return this.repository.recentQueries(userId, 10);
  }

  // deleteAllSearchHistorys => "eliminar historial de búsquedas del usuario"
  public async clearHistory(userId: string): Promise<{ deleted: number }> {
    return { deleted: await this.repository.clearHistory(userId) };
  }
}

// normalizeBrand => comparación de marcas sin mayúsculas ni espacios extremos (función pura)
const normalizeBrand = (name: string) => name.trim().toLowerCase();

export const searchService = new SearchService(searchRepository);
