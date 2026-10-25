// chat.store.ts (Redux Toolkit) => Client State del chat: la conversación que está recibiendo respuesta, el mensaje
// enviado (se pinta antes de que el servidor lo confirme) y los tokens que llegan por streaming SSE.
// El historial y el listado de conversaciones son Server State (TanStack Query en chat.api.ts): nunca se copian aquí.
// Patrón: State (idle -> streaming -> idle | error). Paradigma: funcional (reducers puros con Immer).
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { createSliceHook } from "@/shared/lib/store";

interface ChatStreamState {
  conversationId: string | null;
  pendingContent: string; // Pregunta del usuario mientras llega la respuesta
  text: string; // Respuesta parcial acumulada token a token
  tool: string | null; // Herramienta que el asistente está consultando (search_products, get_order_status...)
  status: "idle" | "streaming" | "error";
  errorCode: string | null; // Código estable del backend (LLM_UNAVAILABLE...): la UI lo traduce
}

const initialState: ChatStreamState = {
  conversationId: null,
  pendingContent: "",
  text: "",
  tool: null,
  status: "idle",
  errorCode: null,
};

export const chatStreamSlice = createSlice({
  name: "chatStream",
  initialState,
  reducers: {
    start: (_state, action: PayloadAction<{ conversationId: string; content: string }>) => ({
      ...initialState,
      conversationId: action.payload.conversationId,
      pendingContent: action.payload.content,
      status: "streaming",
    }),
    // "+=" sobre el borrador de Immer => produce un estado nuevo (inmutable) sin copiar a mano
    appendToken: (state, action: PayloadAction<string>) => {
      state.text += action.payload;
      state.tool = null; // Llegó texto: la consulta terminó
    },
    toolStarted: (state, action: PayloadAction<string>) => {
      state.tool = action.payload;
    },
    finish: () => initialState,
    fail: (state, action: PayloadAction<string>) => {
      state.status = "error";
      state.errorCode = action.payload;
      state.text = "";
    },
  },
});

export const useChatStream = createSliceHook(chatStreamSlice);
