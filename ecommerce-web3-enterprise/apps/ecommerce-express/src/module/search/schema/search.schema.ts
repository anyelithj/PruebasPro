// search.schema.ts => validación Zod del módulo Search.
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";
import { queryArray, queryBoolean } from "../../../shared/pipe/transform.pipe";

export const SearchSorts = ["relevance", "price_asc", "price_desc", "newest", "rating"] as const;

// SearchQuerySchema => GET /api/v1/search?q=&category=&brand=&minPrice=&maxPrice=&attr=size:M&attr=color:Rojo
export const SearchQuerySchema = PaginationQuerySchema.extend({
  q: z.string().trim().min(1, { message: "Escribe qué quieres buscar" }).max(100),
  category: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: queryBoolean,
  // "attr" => facetas de variante "clave:valor"; se transforman a pares [clave, valor]
  attr: queryArray.transform((values) =>
    (values ?? [])
      .map((pair) => pair.split(":"))
      .filter((parts): parts is [string, string] => parts.length === 2 && Boolean(parts[0]) && Boolean(parts[1]))
  ),
  sort: z.enum(SearchSorts).default("relevance"),
});

// SuggestionsQuerySchema => GET /api/v1/search/suggestions?q= (autocompletado accesible)
export const SuggestionsQuerySchema = z.object({ q: z.string().trim().min(2).max(60) });

// SpellingQuerySchema => GET /api/v1/search/spelling?q= (RF-06.1 "¿Quisiste decir…?")
export const SpellingQuerySchema = z.object({ q: z.string().trim().min(3).max(100) });

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
