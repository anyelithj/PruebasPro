// recommendation.ml.ts (LangChain + Ollama) => pipeline de recomendaciones y fábrica ÚNICA del modelo de chat local.
// Patrón Pipeline: 1) candidatos (co-compra, afinidad de categoría, populares) 2) ranking ponderado 3) explicación LLM.
// Paradigma funcional: etapas puras que se componen; solo la última toca la IA.
// Ahorro de recursos (app ecológica):
//   - LangChain se importa de forma PEREZOSA ("await import"): si nadie usa IA, el proceso no carga esas librerías.
//   - Ollama local (0 USD, sin red externa) con modelo pequeño, tope de tokens y "keep_alive" corto: el modelo se
//     descarga de la RAM a los pocos minutos sin uso.
//   - Los candidatos salen de SQL (barato); el LLM solo redacta UNA frase corta (no elige productos).
import type { ChatOllama } from "@langchain/ollama"; // "import type" => solo tipos: no carga la librería en runtime
import { appConfig } from "../../../config/app.config";
import { logger } from "../../../shared/middleware/logger.middleware";
import type { Locale } from "../../../shared/util/i18n.util";

// ChatModelOptions => ajustes por caso de uso (el chatbot habla más que la frase de una recomendación)
export interface ChatModelOptions {
  maxTokens?: number;
  temperature?: number;
}

// createChatModel => Factory Method (Singleton por configuración): crea el ChatOllama de LangChain una sola vez por
// combinación de opciones y lo reutiliza (DRY: lo comparten recommendation, communication y graph-analysis).
// "Map" => caché en memoria; la clave serializa las opciones.
const models = new Map<string, Promise<ChatOllama>>();
export function createChatModel(options: ChatModelOptions = {}): Promise<ChatOllama> {
  const key = `${options.maxTokens ?? appConfig.LLM_MAX_TOKENS}:${options.temperature ?? 0.3}`;
  const existing = models.get(key);
  if (existing) return existing;
  // "import()" dinámico => en CommonJS se compila a require() diferido: LangChain entra en memoria al primer uso
  const created = import("@langchain/ollama").then(
    ({ ChatOllama: Model }) =>
      new Model({
        baseUrl: appConfig.OLLAMA_BASE_URL,
        model: appConfig.OLLAMA_MODEL,
        numPredict: Math.min(options.maxTokens ?? appConfig.LLM_MAX_TOKENS, appConfig.LLM_MAX_TOKENS), // Nunca supera el tope global
        temperature: options.temperature ?? 0.3, // Baja => respuestas estables y cortas
        keepAlive: appConfig.OLLAMA_KEEP_ALIVE, // Ollama libera el modelo tras este tiempo sin peticiones
      })
  );
  models.set(key, created);
  return created;
}

// withTimeout => corta la espera del LLM: un modelo lento no debe bloquear la respuesta HTTP (degradación elegante)
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  // "Promise.race" => gana la primera promesa en resolverse: la respuesta real o el rechazo por tiempo
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("LLM_TIMEOUT")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer); // Libera el temporizador siempre (sin fugas de timers)
  }
}

// contentText => el contenido de un mensaje de LangChain puede ser texto o lista de partes: se normaliza a string
export function contentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part === "string" ? part : String((part as { text?: unknown }).text ?? ""))).join("");
  return "";
}

// --- Ranking (funciones puras: testeables sin base de datos) ---

// Candidate => producto sugerido por una estrategia con su puntaje bruto
export interface Candidate {
  productId: string;
  score: number;
}

// Strategy => fuente de candidatos (Strategy declarativa: un nombre y su peso en el ranking final)
export const STRATEGY_WEIGHTS = { CO_PURCHASE: 3, CATEGORY: 2, POPULAR: 1 } as const;
export type RecommendationStrategy = keyof typeof STRATEGY_WEIGHTS;

// rankCandidates => normaliza cada lista a [0,1], pondera por estrategia, suma y descarta los productos semilla.
// "Record<Strategy, Candidate[]>" => una lista por estrategia; devuelve IDs ordenados y las estrategias usadas.
export function rankCandidates(
  lists: Partial<Record<RecommendationStrategy, Candidate[]>>,
  exclude: ReadonlySet<string>,
  limit: number
): { productIds: string[]; strategies: RecommendationStrategy[] } {
  const totals = new Map<string, number>();
  const used: RecommendationStrategy[] = [];
  for (const [strategy, candidates] of Object.entries(lists) as Array<[RecommendationStrategy, Candidate[]]>) {
    const max = Math.max(0, ...candidates.map((candidate) => candidate.score));
    if (max === 0) continue; // Estrategia sin resultados: no aporta ni figura como usada
    used.push(strategy);
    for (const { productId, score } of candidates) {
      if (exclude.has(productId)) continue; // No se recomienda lo que el usuario ya está viendo o tiene en el carrito
      totals.set(productId, (totals.get(productId) ?? 0) + (score / max) * STRATEGY_WEIGHTS[strategy]);
    }
  }
  // "[...entries].sort" => mayor puntaje primero; "slice" => solo los N mejores
  const productIds = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  return { productIds, strategies: used };
}

// Mensajes de respaldo (sin IA) por idioma: se usan si Ollama no está disponible o tarda demasiado
const FALLBACK_REASON: Record<Locale, Record<RecommendationStrategy, string>> = {
  es: {
    CO_PURCHASE: "Otros clientes compraron estos productos junto con los que estás mirando.",
    CATEGORY: "Productos de las categorías que más te interesan.",
    POPULAR: "Los productos mejor valorados de la tienda.",
  },
  en: {
    CO_PURCHASE: "Other customers bought these together with the products you are viewing.",
    CATEGORY: "Products from the categories you like most.",
    POPULAR: "The store's top-rated products.",
  },
};

// explainRecommendation => una frase corta generada por el LLM local; ante cualquier fallo, texto de respaldo
export async function explainRecommendation(input: {
  locale: Locale;
  strategies: RecommendationStrategy[];
  seedNames: string[];
  productNames: string[];
}): Promise<string> {
  const primary = input.strategies[0] ?? "POPULAR";
  const fallback = FALLBACK_REASON[input.locale][primary];
  if (input.productNames.length === 0) return fallback;
  try {
    const model = await createChatModel({ maxTokens: 60, temperature: 0.4 }); // ~1 frase: mínimo cómputo
    const language = input.locale === "en" ? "English" : "español";
    // Tuplas [rol, texto] => formato de mensajes que acepta LangChain sin importar clases adicionales
    const reply = await withTimeout(
      model.invoke([
        ["system", `Eres un asesor de compras. Responde en ${language} con UNA sola frase de máximo 25 palabras, sin listas ni comillas.`],
        [
          "human",
          `El cliente mira: ${input.seedNames.join(", ") || "la tienda"}. Recomendamos: ${input.productNames.slice(0, 5).join(", ")}. ` +
            `Motivo principal: ${primary}. Explica por qué le pueden gustar.`,
        ],
      ]),
      10_000
    );
    const text = contentText(reply.content).trim();
    return text.length > 0 ? text.slice(0, 300) : fallback; // Recorte defensivo: el LLM no controla el tamaño del documento
  } catch (error) {
    logger.debug("recommendation_llm_unavailable", { reason: error instanceof Error ? error.message : String(error) });
    return fallback;
  }
}
