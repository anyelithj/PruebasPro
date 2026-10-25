// graph.service.ts => casos de uso del Análisis Relacional IA (sprint 6.1): ejecutar el grafo de LangGraph, guardar el
// resultado, listar análisis, ver las relaciones de un producto y borrar análisis.
import { graphRepository, type GraphRepository } from "../repository/graph.repository";
import { runGraphAnalysis } from "../ml/graph.ml";
import { GraphNodeNotFoundException, GraphResultNotFoundException } from "../exception/graph.exception";
import type { GraphQueryDto, ProductRelationDto } from "../dto/graph.dto";
import type { GraphQueryInput } from "../schema/graph.schema";
import { productRepository } from "../../product/repository/product.repository";
import { buildPaginationMeta, toPageParams, type PaginationQuery } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import type { Locale } from "../../../shared/util/i18n.util";

const NEIGHBORS = 8; // Vecinos por relación en la ficha del nodo

export class GraphService {
  constructor(private readonly repository: GraphRepository) {}

  // createGraphQueryResult => "body: { queryType, params }": corre el pipeline y guarda el resultado
  public async createGraphQueryResult(input: GraphQueryInput, userId: string, locale: Locale): Promise<GraphQueryDto> {
    const startedAt = Date.now();
    const state = await runGraphAnalysis(input, locale);
    return this.repository.saveResult({
      queryType: input.queryType,
      params: input.params,
      nodes: state.nodes,
      edges: state.edges,
      summary: state.summary,
      durationMs: Date.now() - startedAt,
      createdBy: userId,
    });
  }

  // listProductGraphs => "listar análisis del grafo generados" (sin nodos/aristas: listado liviano)
  public async listProductGraphs(query: PaginationQuery): Promise<{ items: GraphQueryDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findResults(page);
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // getProductGraphById => "detalle técnico del nodo por ID": el producto y sus tres tipos de vecinos.
  // "Promise.all" => las tres consultas corren en paralelo (menor latencia)
  public async getProductGraphById(productId: string): Promise<ProductRelationDto> {
    const [product] = await productRepository.findCardsByIds([productId]);
    if (!product) throw new GraphNodeNotFoundException(productId);
    const [together, relatedIds, similarIds] = await Promise.all([
      this.repository.purchasedTogether([productId], NEIGHBORS),
      this.repository.related(productId, NEIGHBORS),
      this.repository.similar(productId, NEIGHBORS),
    ]);
    // Una sola consulta de tarjetas para los tres grupos (sin N+1)
    const cards = new Map((await productRepository.findCardsByIds([...together.map((t) => t.productId), ...relatedIds, ...similarIds])).map((card) => [card.id, card]));
    const pick = (ids: string[]) => ids.flatMap((id) => cards.get(id) ?? []);
    return {
      product,
      purchasedTogether: together.flatMap(({ productId: id, weight }) => {
        const card = cards.get(id);
        return card ? [{ ...card, weight }] : [];
      }),
      related: pick(relatedIds),
      similar: pick(similarIds),
    };
  }

  // deleteProductGraphById => elimina un análisis guardado
  public async deleteProductGraphById(id: string): Promise<void> {
    if (!(await this.repository.deleteResult(id))) throw new GraphResultNotFoundException(id);
  }
}

export const graphService = new GraphService(graphRepository);
