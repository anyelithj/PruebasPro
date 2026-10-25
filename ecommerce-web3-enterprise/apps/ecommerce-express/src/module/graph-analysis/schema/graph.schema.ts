// graph.schema.ts => validación Zod del módulo Graph Analysis.
import { z } from "zod";
import { PaginationQuerySchema } from "../../../shared/util/pagination.util";

const limit = z.number().int().min(1).max(50).default(12); // Vecinos por consulta (acotado: grafos pequeños = poca CPU)
const explain = z.boolean().default(false); // Resumen con IA solo si se pide (el LLM es lo más costoso en energía)

// GraphQuerySchema => POST /api/v1/product-graph/query — body { queryType, params }
// "discriminatedUnion" => Zod elige el schema de "params" según "queryType" (tipado exacto por variante)
export const GraphQuerySchema = z.discriminatedUnion("queryType", [
  z.object({ queryType: z.literal("RELATED"), params: z.object({ productId: z.string().uuid(), limit, explain }) }),
  z.object({ queryType: z.literal("PURCHASED_TOGETHER"), params: z.object({ productId: z.string().uuid(), limit, explain }) }),
  z.object({ queryType: z.literal("SIMILAR"), params: z.object({ productId: z.string().uuid(), limit, explain }) }),
  z.object({
    queryType: z.literal("CLUSTER"),
    params: z.object({
      minWeight: z.number().int().min(1).max(100).default(2), // Pedidos en común mínimos para unir dos productos
      maxEdges: z.number().int().min(10).max(500).default(200),
      explain,
    }),
  }),
]);

export const ListGraphQuerySchema = PaginationQuerySchema;

export type GraphQueryInput = z.infer<typeof GraphQuerySchema>;
