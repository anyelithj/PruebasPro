// graph.dto.ts => contratos de salida del módulo Graph Analysis (vista D3/Recharts del admin, Fase 7.3).
import type { GraphQueryType } from "../model/graph.model";
import type { ProductListItemDto } from "../../product/dto/product.dto";

// GraphNodeDto => nodo = producto; "group" = número de clúster (CLUSTER) o 0
export interface GraphNodeDto {
  id: string;
  name: string;
  slug: string;
  group: number;
}

// GraphEdgeDto => arista ponderada (weight = pedidos en común o puntaje de similitud)
export interface GraphEdgeDto {
  source: string;
  target: string;
  weight: number;
}

// GraphQueryDto => resultado guardado de un análisis
export interface GraphQueryDto {
  id: string;
  queryType: GraphQueryType;
  params: Record<string, unknown>;
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  summary: string | null;
  durationMs: number;
  createdAt: Date;
}

// ProductRelationDto => GET /product-graph/:id/relation: un nodo con sus vecinos por tipo de relación
export interface ProductRelationDto {
  product: ProductListItemDto;
  purchasedTogether: Array<ProductListItemDto & { weight: number }>;
  related: ProductListItemDto[];
  similar: ProductListItemDto[];
}
