// chat.api.ts => cliente del LLM Assistant de FastAPI (sprint 5B.4): conversaciones con Axios + TanStack Query
// (Server State) y respuesta en streaming SSE con fetch + ReadableStream (Axios no expone el cuerpo por partes en el
// navegador). Patrones: Gateway (único punto de acceso a /llm), Observer (cada evento SSE actualiza la UI) y
// Command (send/stop). Paradigma: asíncrono (async generators) + funcional.
// Los campos llegan en snake_case tal como los define llm_schema.py (sin capa de mapeo: menos código y CPU).
"use client";

import { useCallback, useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiGet, apiRequest, localeHeader } from "@/shared/lib/api-client";
import { queryKeys } from "@/shared/lib/query-client";
import { config } from "@/shared/constants/config";
import { useAuth } from "@/shared/hook/useAuth";
import { useChatStream } from "../model/chat.store";
import type { Feedback } from "../lib/chat.validator";

export interface LlmConversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

// LlmSource => fuente RAG citada en la respuesta ([n] en el texto); sin el fragmento: solo título y relevancia
export interface LlmSource {
  id: string;
  source: "product" | "faq" | "policy";
  title: string;
  score: number;
}

export interface LlmMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  latency_ms: number | null;
  feedback: Feedback | null;
  sources: LlmSource[] | null; // Solo respuestas del asistente con contexto RAG (5B.2)
  created_at: string;
}

interface ConversationPage {
  items: LlmConversation[];
  next_cursor: string | null; // null => no hay más páginas
}

type ConversationDetail = LlmConversation & { messages: LlmMessage[] };

const BASE = "/llm/conversations";

// useMl => opciones comunes de toda petición al motor IA (DRY): otra URL base, mismo contrato { success, data }
function useMl() {
  const { accessToken, isAuthenticated } = useAuth();
  return {
    options: { baseUrl: config.mlApiUrl, token: accessToken },
    accessToken,
    isAuthenticated,
  };
}

// useConversations => listado por cursor ("useInfiniteQuery": cada página pide las anteriores a la última vista)
export function useConversations() {
  const { options, isAuthenticated } = useMl();
  return useInfiniteQuery({
    queryKey: queryKeys.llmConversations,
    queryFn: ({ pageParam }) =>
      apiGet<ConversationPage>(BASE, { ...options, query: { cursor: pageParam, limit: 20 } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: isAuthenticated,
  });
}

// useConversation => historial de la conversación activa (solo propietario: FastAPI responde 403/404 si no)
export function useConversation(id: string | null) {
  const { options, isAuthenticated } = useMl();
  return useQuery({
    queryKey: queryKeys.llmConversation(id ?? ""),
    queryFn: () => apiGet<ConversationDetail>(`${BASE}/${id}`, options),
    enabled: Boolean(id) && isAuthenticated,
  });
}

export function useCreateConversation() {
  const { options } = useMl();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () =>
      (await apiRequest<{ conversation_id: string }>(BASE, { ...options, method: "POST" })).data
        .conversation_id,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.llmConversations }),
  });
}

// useDeleteConversation => borrado GDPR: conversación + mensajes + contexto en Redis (lo hace FastAPI)
export function useDeleteConversation() {
  const { options } = useMl();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`${BASE}/${id}`, { ...options, method: "DELETE" }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.llmConversation(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.llmConversations });
    },
  });
}

// useMessageFeedback => 👍/👎; actualiza la caché en sitio (setQueryData) en vez de volver a pedir el historial
export function useMessageFeedback(conversationId: string) {
  const { options } = useMl();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, feedback }: { messageId: string; feedback: Feedback }) =>
      apiRequest<LlmMessage>(`${BASE}/${conversationId}/messages/${messageId}`, {
        ...options,
        method: "PATCH",
        body: { feedback },
      }),
    onSuccess: ({ data }) =>
      queryClient.setQueryData<ConversationDetail>(
        queryKeys.llmConversation(conversationId),
        (current) =>
          current
            ? {
                ...current,
                messages: current.messages.map((message) =>
                  message.id === data.id ? data : message
                ),
              }
            : current
      ),
  });
}

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

// readSse => async generator: convierte el cuerpo "text/event-stream" en eventos { event, data }. Los bloques se
// separan por una línea vacía y pueden llegar partidos entre fragmentos de red (por eso el búfer)
async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder(); // "stream: true" => un emoji partido entre dos fragmentos se une bien
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? ""; // El último puede estar incompleto: espera al siguiente fragmento
    for (const block of blocks) {
      const fields = Object.fromEntries(
        block
          .split("\n")
          .map((line) => [
            line.slice(0, line.indexOf(":")),
            line.slice(line.indexOf(":") + 1).trim(),
          ])
      );
      if (fields.event && fields.data)
        yield { event: fields.event, data: JSON.parse(fields.data) as Record<string, unknown> };
    }
  }
}

// toStreamError => respuesta HTTP no exitosa (404/403/422/503) -> ApiError con el código del backend
async function toStreamError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    code?: string;
    message?: string;
  } | null;
  return new ApiError(
    response.status,
    body?.code ?? "NETWORK_ERROR",
    body?.message ?? response.statusText
  );
}

// consumeStream => recorre los eventos SSE: "token" se pinta, "tool" avisa qué herramienta consulta el asistente
// (pedido, stock, búsqueda), "error" se lanza como ApiError ("done" cierra el stream)
async function consumeStream(
  response: Response,
  onToken: (text: string) => void,
  onTool: (name: string) => void
): Promise<void> {
  if (!response.ok || !response.body) throw await toStreamError(response);
  for await (const { event, data } of readSse(response.body)) {
    if (event === "token") onToken(String(data["text"] ?? ""));
    if (event === "tool") onTool(String(data["name"] ?? ""));
    if (event === "error") throw new ApiError(503, String(data["code"]), String(data["message"]));
  }
}

// useSendMessage => envía la pregunta y pinta la respuesta token a token. Cancela la petición al salir de la página
// o con "stop" (AbortController): Ollama deja de generar y no se gasta CPU en una respuesta que nadie lee
export function useSendMessage() {
  const { accessToken } = useMl();
  const queryClient = useQueryClient();
  const stream = useChatStream();
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []); // Limpieza al desmontar (cleanup de useEffect)

  const { start, appendToken, toolStarted, finish, fail } = stream;
  const send = useCallback(
    async (conversationId: string, content: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      start({ conversationId, content });
      try {
        const response = await fetch(`${config.mlApiUrl}${BASE}/${conversationId}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Authorization: `Bearer ${accessToken ?? ""}`,
            ...localeHeader(),
          },
          body: JSON.stringify({ content }),
          signal: controller.signal,
        });
        await consumeStream(response, appendToken, toolStarted);
        // Primero llega el historial guardado y luego se limpia el parcial: la respuesta no "parpadea"
        await queryClient.invalidateQueries({
          queryKey: queryKeys.llmConversation(conversationId),
        });
        finish();
      } catch (error) {
        if (controller.signal.aborted) finish();
        else fail(error instanceof ApiError ? error.code : "NETWORK_ERROR");
        void queryClient.invalidateQueries({ queryKey: queryKeys.llmConversation(conversationId) }); // La pregunta sí se guardó
      } finally {
        void queryClient.invalidateQueries({ queryKey: queryKeys.llmConversations }); // Título y orden del listado
      }
    },
    [accessToken, queryClient, start, appendToken, toolStarted, finish, fail]
  );

  return { ...stream, send, stop: () => abortRef.current?.abort() };
}
