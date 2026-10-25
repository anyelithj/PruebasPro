// search.controller.ts => capa HTTP del módulo Search.
import type { Request, Response } from "express";
import { searchService } from "../service/search.service";
import { SearchQuerySchema, SpellingQuerySchema, SuggestionsQuerySchema } from "../schema/search.schema";
import { asyncHandler, sendSuccess } from "../../../shared/interceptor/transform.interceptor";
import { currentUser } from "../../../shared/decorator/auth.decorator";
import { HttpStatus } from "../../../shared/constants/http.constants";

export class SearchController {
  // listSearchResults => GET /api/v1/search?q=
  public readonly search = asyncHandler(async (req: Request, res: Response) => {
    const result = await searchService.search(SearchQuerySchema.parse(req.query), req.user?.id);
    const { meta, ...data } = result; // "meta" va en el sobre estándar (junto a "data")
    sendSuccess(res, data, HttpStatus.OK, meta);
  });

  // suggestions => GET /api/v1/search/suggestions?q=
  public readonly suggestions = asyncHandler(async (req: Request, res: Response) => {
    const { q } = SuggestionsQuerySchema.parse(req.query);
    res.setHeader("Cache-Control", "public, max-age=60"); // Autocompletado cacheable en el navegador
    sendSuccess(res, await searchService.suggestions(q));
  });

  // spelling => GET /api/v1/search/spelling?q= (RF-06.1) => { query, suggestion } (suggestion = null si no hay corrección)
  public readonly spelling = asyncHandler(async (req: Request, res: Response) => {
    const { q } = SpellingQuerySchema.parse(req.query);
    res.setHeader("Cache-Control", "public, max-age=300"); // Misma consulta => misma corrección (cacheable)
    sendSuccess(res, { query: q, suggestion: await searchService.spelling(q) });
  });

  // createSearchResult => POST /api/v1/search/image (multipart: campo "file")
  public readonly searchByImage = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await searchService.searchByImage(req.file, req.user?.id));
  });

  // GET /api/v1/search/history => búsquedas recientes del usuario (SearchSuggestions)
  public readonly recentSearches = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await searchService.recentSearches(currentUser(req).id));
  });

  // deleteAllSearchHistorys => DELETE /api/v1/search/history
  public readonly clearHistory = asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await searchService.clearHistory(currentUser(req).id));
  });
}

export const searchController = new SearchController();
