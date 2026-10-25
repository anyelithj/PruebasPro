// graph.ml.ts (LangGraph + Ollama) => pipeline del análisis relacional como GRAFO DE ESTADOS de LangGraph:
//   START -> analyze (estrategia SQL según queryType) -> [¿explain?] -> explain (LLM local) -> END
// Patrones: Pipeline (nodos encadenados), Strategy (un analizador por tipo de consulta) y Singleton (el grafo se
// compila UNA vez y se reutiliza). Paradigma funcional: cada nodo recibe el estado y devuelve solo lo que cambia.
// Ahorro de recursos: LangGraph se importa de forma perezosa y el nodo "explain" (LLM, lo más costoso) es OPCIONAL.
import { graphRepository } from "../repository/graph.repository";
import type { GraphEdgeDto, GraphNodeDto } from "../dto/graph.dto";
import type { GraphQueryInput } from "../schema/graph.schema";
import type { GraphQueryType } from "../model/graph.model";
import { contentText, createChatModel, withTimeout } from "../../recommendation/ml/recommendation.ml";
import type { Locale } from "../../../shared/util/i18n.util";
import { logger } from "../../../shared/middleware/logger.middleware";

// GraphState => estado que viaja por los nodos del grafo de LangGraph
export interface GraphState {
  query: GraphQueryInput;
  locale: Locale;
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
  summary: string | null;
}

type Analysis = Pick<GraphState, "nodes" | "edges">;

// connectedComponents => Union-Find (conjuntos disjuntos) con compresión de caminos: asigna un número de clúster a
// cada producto conectado por co-compra. Función PURA: O(E·α(N)) sin tocar la base de datos.
export function connectedComponents(edges: readonly GraphEdgeDto[]): Map<string, number> {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) ?? root;
    parent.set(id, root); // Compresión: el siguiente "find" de este id es O(1)
    return root;
  };
  for (const { source, target } of edges) {
    if (!parent.has(source)) parent.set(source, source);
    if (!parent.has(target)) parent.set(target, target);
    parent.set(find(source), find(target)); // Unión de ambos conjuntos
  }
  const groups = new Map<string, number>();
  const ids = new Map<string, number>(); // raíz -> número de clúster secuencial (1, 2, 3...)
  for (const id of parent.keys()) {
    const root = find(id);
    if (!ids.has(root)) ids.set(root, ids.size + 1);
    groups.set(id, ids.get(root) ?? 0);
  }
  return groups;
}

// star => grafo "estrella": el producto consultado en el centro y sus vecinos alrededor
async function star(productId: string, neighbors: Array<{ productId: string; weight: number }>): Promise<Analysis> {
  const nodes = await graphRepository.nodes([productId, ...neighbors.map((n) => n.productId)]);
  const visible = new Set(nodes.map((node) => node.id)); // Solo aristas hacia productos activos
  return { nodes, edges: neighbors.filter((n) => visible.has(n.productId)).map((n) => ({ source: productId, target: n.productId, weight: n.weight })) };
}

const unweighted = (ids: string[]) => ids.map((productId) => ({ productId, weight: 1 }));

// ANALYZERS => Strategy por tipo de consulta ("Record" exhaustivo: el compilador exige los 4 tipos)
const ANALYZERS: { [K in GraphQueryType]: (params: Extract<GraphQueryInput, { queryType: K }>["params"]) => Promise<Analysis> } = {
  RELATED: async (params) => star(params.productId, unweighted(await graphRepository.related(params.productId, params.limit))),
  SIMILAR: async (params) => star(params.productId, unweighted(await graphRepository.similar(params.productId, params.limit))),
  PURCHASED_TOGETHER: async (params) => star(params.productId, await graphRepository.purchasedTogether([params.productId], params.limit)),
  CLUSTER: async (params) => {
    const edges = await graphRepository.coPurchaseEdges(params.minWeight, params.maxEdges);
    const groups = connectedComponents(edges);
    return { nodes: await graphRepository.nodes([...groups.keys()], groups), edges };
  },
};

// analyze => despacha a la estrategia; la aserción es segura porque "query" es la unión discriminada validada por Zod
function analyze(query: GraphQueryInput): Promise<Analysis> {
  const analyzer = ANALYZERS[query.queryType] as (params: GraphQueryInput["params"]) => Promise<Analysis>;
  return analyzer(query.params);
}

// explain => resumen en lenguaje natural de las relaciones más fuertes (Ollama local, máx. 3 frases)
async function explain(state: GraphState): Promise<string | null> {
  const names = new Map(state.nodes.map((node) => [node.id, node.name]));
  const top = [...state.edges].sort((a, b) => b.weight - a.weight).slice(0, 12); // Prompt corto = menos cómputo
  const lines = top.map((edge) => `${names.get(edge.source) ?? edge.source} — ${names.get(edge.target) ?? edge.target} (peso ${edge.weight})`);
  try {
    const model = await createChatModel({ maxTokens: 160, temperature: 0.2 });
    const reply = await withTimeout(
      model.invoke([
        ["system", `Eres analista de e-commerce. Responde en ${state.locale === "en" ? "English" : "español"}, máximo 3 frases, sin inventar datos.`],
        ["human", `Análisis ${state.query.queryType} del grafo de productos. Relaciones más fuertes:\n${lines.join("\n")}\n¿Qué patrón comercial muestran?`],
      ]),
      20_000
    );
    return contentText(reply.content).trim().slice(0, 1000) || null;
  } catch (error) {
    logger.debug("graph_llm_unavailable", { reason: error instanceof Error ? error.message : String(error) });
    return null; // Sin IA el análisis sigue siendo útil: nodos y aristas
  }
}

// buildGraph => compila el StateGraph de LangGraph (import perezoso: la librería se carga al primer análisis)
async function buildGraph() {
  const { Annotation, StateGraph, START, END } = await import("@langchain/langgraph");
  // Annotation.Root => esquema del estado; cada campo usa el reductor por defecto (el último valor gana)
  const State = Annotation.Root({
    query: Annotation<GraphQueryInput>(),
    locale: Annotation<Locale>(),
    nodes: Annotation<GraphNodeDto[]>(),
    edges: Annotation<GraphEdgeDto[]>(),
    summary: Annotation<string | null>(),
  });
  return new StateGraph(State)
    .addNode("analyze", async (state) => analyze(state.query))
    .addNode("explain", async (state) => ({ summary: await explain(state) }))
    .addEdge(START, "analyze")
    // Arista condicional: solo se gasta energía en el LLM si se pidió y hay relaciones que explicar
    .addConditionalEdges("analyze", (state) => (state.query.params.explain && state.edges.length > 0 ? "explain" : END), ["explain", END])
    .addEdge("explain", END)
    .compile();
}

// Singleton perezoso del grafo compilado ("??=" lo crea solo la primera vez)
let compiled: ReturnType<typeof buildGraph> | undefined;

// runGraphAnalysis => punto de entrada del pipeline para graph.service
export async function runGraphAnalysis(query: GraphQueryInput, locale: Locale): Promise<GraphState> {
  compiled ??= buildGraph();
  const graph = await compiled;
  const result = await graph.invoke({ query, locale, nodes: [], edges: [], summary: null });
  return { query, locale, nodes: result.nodes, edges: result.edges, summary: result.summary ?? null };
}
