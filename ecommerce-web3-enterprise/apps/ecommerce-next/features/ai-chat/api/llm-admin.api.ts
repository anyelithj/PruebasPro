// llm-admin.api.ts => contratos y rutas del panel admin del LLM Assistant (FastAPI, sprints 5B.2/5B.3/5B.5, rol ADMIN):
// conocimiento RAG (/knowledge), auditoría de herramientas (/tool-calls) y evaluaciones (/evaluations).
// Patrón Repository/Gateway: el panel (/dashboard/ai-assistant) solo conoce estas constantes y tipos; las peticiones
// las hace el hook genérico del panel con "baseUrl" = FastAPI (mismo sobre { success, data, meta }).
// Los campos llegan en snake_case tal como los define llm_schema.py (sin capa de mapeo: menos código y CPU).
import { config } from "@/shared/constants/config";

// LLM_ADMIN => "as const" (TypeScript): objeto inmutable con literales exactos (rutas tipadas, sin errores de dedo)
export const LLM_ADMIN = {
  baseUrl: config.mlApiUrl, // Motor IA (FastAPI), no Express
  knowledge: "/llm/knowledge",
  knowledgeIndex: "/llm/knowledge/index",
  toolCalls: "/llm/tool-calls",
  evaluations: "/llm/evaluations",
} as const;

// Fuentes indexables (KnowledgeSource en knowledge_indexer.py) y su valor guardado en la tabla
export const KNOWLEDGE_SOURCES = ["products", "faq", "policies"] as const;
export const CHUNK_SOURCES = ["product", "faq", "policy"] as const;
export const TOOL_STATUSES = ["ok", "denied", "not_found", "rejected", "error"] as const;

// "interface" => forma del JSON (fechas como string ISO); sin "embedding": 768 números que la UI no usa
export interface KnowledgeChunk {
  id: string;
  source: (typeof CHUNK_SOURCES)[number];
  source_id: string;
  lang: "es" | "en";
  category: string | null;
  title: string;
  content: string;
  created_at: string;
}

export interface LlmToolCall {
  id: string;
  conversation_id: string;
  message_id: string | null;
  user_id: string;
  tool: string;
  arguments: Record<string, unknown>;
  status: (typeof TOOL_STATUSES)[number];
  http_status: number | null;
  latency_ms: number;
  created_at: string;
}

export interface LlmEvaluationRun {
  id: string;
  status: string; // PENDING | RUNNING | COMPLETED | FAILED (Celery)
  tier: "economic" | "strong";
  model: string | null;
  questions: number | null;
  faithfulness: number | null;
  hallucination_rate: number | null;
  keyword_recall: number | null;
  avg_latency_ms: number | null;
  est_tokens: number | null;
  mlflow_run_id: string | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}
