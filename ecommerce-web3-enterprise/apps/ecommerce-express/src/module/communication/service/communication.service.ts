// communication.service.ts => chat del cliente (sprint 6.1): bot IA 24/7 con LangChain + Ollama, escalado bot -> agente
// humano y mensajes en tiempo real (los eventos los reenvía el gateway de Socket.io: communication.event.ts).
// Patrones: Chain of Responsibility (manejadores del bot: pedir humano -> FAQ -> LLM), Observer (bus de eventos),
// Command (cada mensaje entrante) y Facade (un método por caso de uso).
// Ahorro de energía: las preguntas frecuentes se responden SIN IA; el LLM solo atiende lo que la FAQ no cubre,
// con historial corto (8 mensajes) y tope de tokens.
import { communicationRepository, type CommunicationRepository } from "../repository/communication.repository";
import { ConversationClosedException, ConversationNotFoundException } from "../exception/communication.exception";
import type { ConversationDto, ConversationSummaryDto, MessageDto, NluInfo, SupportMetricsDto } from "../dto/communication.dto";
import axios from "axios";
import { chatwootProvider, type CannedResponse } from "../provider/chatwoot.provider"; // RF-17.11
import { appConfig } from "../../../config/app.config";
import { prisma } from "../../../config/database.config";
import { signServiceToken } from "../../auth/util/token.util";
import type { ConversationStatus } from "../model/communication.model";
import type { CreateConversationInput, ListConversationsQuery } from "../schema/communication.schema";
import { contentText, createChatModel, withTimeout } from "../../recommendation/ml/recommendation.ml";
import { TypedEventBus } from "../../../shared/util/event-bus.util";
import { isAdmin } from "../../../shared/decorator/auth.decorator";
import { buildPaginationMeta, toPageParams } from "../../../shared/util/pagination.util";
import type { PaginationMeta } from "../../../shared/types/pagination.types";
import type { Locale } from "../../../shared/util/i18n.util";
import { logger } from "../../../shared/middleware/logger.middleware";

interface Viewer {
  id: string;
  roles: string[];
}

// communicationEvents => bus del chat (Observer): el service publica, el gateway de Socket.io entrega a cada sala
export const communicationEvents = new TypedEventBus<{
  "conversation.message": { conversationId: string; message: MessageDto };
  "conversation.token": { conversationId: string; token: string }; // Streaming del bot, token a token
  "conversation.escalated": { conversationId: string; userId: string; reason: string };
}>("communication");

// --- Chain of Responsibility del bot ---

interface BotContext {
  conversation: ConversationDto;
  text: string; // Puede reemplazarse por el texto corregido (RF-17.9) antes de los eslabones siguientes
  locale: Locale;
  messageId: string;
}
interface BotReply {
  text: string;
  escalate: boolean;
  reason?: string; // Motivo del escalado (métricas RF-17.12)
}
// BotHandler => cada eslabón responde o devuelve null para pasar al siguiente
interface BotHandler {
  handle(context: BotContext): Promise<BotReply | null>;
}

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ESCALATE_MARKER = "[ESCALAR]"; // El LLM lo responde cuando no está seguro => escalado por baja confianza

// 1) El cliente pide hablar con una persona
class HumanRequestHandler implements BotHandler {
  private readonly pattern = /\b(humano|agente|asesor|persona real|human|agent|real person)\b/;
  public async handle({ text, locale }: BotContext): Promise<BotReply | null> {
    if (!this.pattern.test(normalize(text))) return null;
    return { escalate: true, text: locale === "en" ? "I'll connect you with an agent right away." : "Te comunico con un asesor enseguida." };
  }
}

// detectNlu => FastAPI /ml/nlp/intent: intención + confianza + entidades + ortografía (token de SERVICIO). El id de la
// conversación hace que el mensaje real alimente el entrenamiento continuo (RF-17.13). null si FastAPI no responde
async function detectNlu(text: string, conversationId: string): Promise<NluInfo | null> {
  try {
    const { data } = await axios.post<{ data: { intent: string; intent_score: number; entities: NluInfo["entities"]; normalized_text: string; low_confidence: boolean } }>(
      `${appConfig.FASTAPI_URL}/api/v1/ml/nlp/intent`,
      { text, conversation_id: conversationId },
      { timeout: 8000, headers: { Authorization: `Bearer ${signServiceToken()}` } }
    );
    const result = data.data;
    return {
      intent: result.intent,
      score: result.intent_score,
      entities: result.entities.map(({ label, text: value, ...rest }) => ({ label, text: value, ...("value" in rest ? { value: Number(rest.value) } : {}) })),
      corrected: result.normalized_text,
      lowConfidence: result.intent_score < appConfig.NLU_CONFIDENCE_THRESHOLD,
    };
  } catch {
    return null;
  }
}

// 1b) Comprensión (RF-17.2 / 17.9 / 17.10): guarda intención y entidades en el mensaje, corrige el texto para los
// eslabones siguientes y, si el bot NO entiende dos mensajes seguidos, escala a una persona con el motivo
class NluHandler implements BotHandler {
  constructor(private readonly repository: CommunicationRepository) {}
  public async handle(context: BotContext): Promise<BotReply | null> {
    const nlu = await detectNlu(context.text, context.conversation.id);
    if (!nlu) return null; // Sin FastAPI la cadena sigue igual que antes (degradación parcial)
    await this.repository.setNlu(context.conversation.id, context.messageId, nlu);
    if (nlu.corrected) context.text = nlu.corrected;
    if (nlu.intent === "human") return null; // Lo atiende HumanRequestHandler/LLM con su propio texto
    const streak = await this.repository.bumpLowConfidence(context.conversation.id, nlu.lowConfidence);
    if (streak >= 2) {
      return {
        escalate: true,
        reason: `Baja confianza (${Math.round(nlu.score * 100)} %)`,
        text: context.locale === "en" ? "I want to make sure you get the right answer: an agent will continue this chat." : "Quiero que tengas la respuesta correcta: un asesor continuará esta conversación.",
      };
    }
    return null;
  }
}

// 2) Preguntas frecuentes: respuesta inmediata sin IA (cero cómputo de GPU/CPU para lo más común)
const FAQ: Array<{ keywords: RegExp; answer: Record<Locale, string> }> = [
  {
    keywords: /\b(envio|envios|despacho|shipping|delivery)\b/,
    answer: { es: "Los envíos tardan de 2 a 5 días hábiles; puedes seguir tu pedido en Mi cuenta > Pedidos.", en: "Shipping takes 2–5 business days; track your order in My account > Orders." },
  },
  {
    keywords: /\b(devolucion|devoluciones|reembolso|return|refund)\b/,
    answer: { es: "Tienes 30 días para devolver un producto desde Mi cuenta > Pedidos > Solicitar devolución.", en: "You have 30 days to return a product from My account > Orders > Request return." },
  },
  {
    keywords: /\b(pago|pagos|tarjeta|pse|payment|card)\b/,
    answer: { es: "Aceptamos tarjetas, PSE y cripto con Stripe; el cobro se confirma al instante.", en: "We accept cards, PSE and crypto through Stripe; payment is confirmed instantly." },
  },
];
class FaqHandler implements BotHandler {
  public async handle({ text, locale }: BotContext): Promise<BotReply | null> {
    const hit = FAQ.find((entry) => entry.keywords.test(normalize(text)));
    return hit ? { escalate: false, text: hit.answer[locale] } : null;
  }
}

// 3) LLM local (LangChain + Ollama) con streaming token a token; si falla o no está seguro, escala
class LlmHandler implements BotHandler {
  public async handle({ conversation, text, locale }: BotContext): Promise<BotReply> {
    const history = conversation.messages.slice(-8).map((m) => [m.role === "USER" ? "human" : "ai", m.content] as [string, string]);
    const system =
      `Eres el asistente de una tienda en línea. Responde en ${locale === "en" ? "English" : "español"}, breve (máx. 3 frases). ` +
      `No inventes precios, stock ni estados de pedido. Si no sabes la respuesta o el cliente está molesto, responde exactamente ${ESCALATE_MARKER}.`;
    try {
      const model = await createChatModel({ maxTokens: 200, temperature: 0.3 });
      // "stream" => async iterable de fragmentos: cada token se publica al instante (el cliente ve la respuesta escribirse)
      const reply = await withTimeout(
        (async () => {
          let full = "";
          for await (const chunk of await model.stream([["system", system], ...history, ["human", text]])) {
            const token = contentText(chunk.content);
            full += token;
            // Se deja de transmitir si aparece "[" (posible marcador de escalado): el cliente no ve "[ESCALAR]"
            if (!full.includes("[")) communicationEvents.emit("conversation.token", { conversationId: conversation.id, token });
          }
          return full.trim();
        })(),
        45_000
      );
      if (reply.length === 0 || reply.includes(ESCALATE_MARKER)) return { escalate: true, text: locale === "en" ? "Let me connect you with an agent." : "Déjame comunicarte con un asesor." };
      return { escalate: false, text: reply.slice(0, 2000) };
    } catch (error) {
      logger.warn("chatbot_llm_unavailable", { conversationId: conversation.id, reason: error instanceof Error ? error.message : String(error) });
      return { escalate: true, text: locale === "en" ? "Our assistant is unavailable; an agent will reply soon." : "El asistente no está disponible; un asesor te responderá pronto." };
    }
  }
}

const ACTIVE: ConversationStatus[] = ["OPEN", "ESCALATED"];

export class CommunicationService {
  private readonly chain: BotHandler[];

  constructor(private readonly repository: CommunicationRepository) {
    // Cadena: pedir humano -> comprensión (NLU) -> FAQ -> LLM
    this.chain = [new HumanRequestHandler(), new NluHandler(repository), new FaqHandler(), new LlmHandler()];
  }

  // createConversation => "iniciar interacción — tipo [HUMAN|AI] en DTO"
  public async createConversation(input: CreateConversationInput, viewer: Viewer, locale: Locale): Promise<ConversationDto> {
    const conversation = await this.repository.create(viewer.id, input.type, input.channel);
    if (input.type === "HUMAN") await this.escalate(conversation, "Solicitado por el cliente");
    if (input.message) await this.postMessage(conversation.id, input.message, viewer, locale);
    return (await this.repository.findById(conversation.id)) ?? conversation;
  }

  // listConversations => "listar conversaciones activas por canal" (agente: todas; cliente: las suyas)
  public async listConversations(query: ListConversationsQuery, viewer: Viewer): Promise<{ items: ConversationSummaryDto[]; meta: PaginationMeta }> {
    const page = toPageParams(query);
    const { items, total } = await this.repository.findMany(
      { userId: isAdmin(viewer) ? undefined : viewer.id, channel: query.channel, statuses: query.status ? [query.status] : ACTIVE },
      page
    );
    return { items, meta: buildPaginationMeta(page, total) };
  }

  // getConversationById => "historial detallado de conversación por ID"
  public async getConversationById(id: string, viewer: Viewer): Promise<ConversationDto> {
    return this.accessible(id, viewer);
  }

  // updateConversation => "escalar conversación bot -> agente humano"
  public async updateConversation(id: string, reason: string, viewer: Viewer): Promise<ConversationDto> {
    const conversation = await this.accessible(id, viewer);
    if (conversation.status !== "OPEN") throw new ConversationClosedException(conversation.status);
    return this.escalate(conversation, reason);
  }

  // deleteConversationById => "archivar conversación específica" (se borra sola a los 90 días)
  public async deleteConversationById(id: string, viewer: Viewer): Promise<void> {
    const conversation = await this.accessible(id, viewer);
    const now = new Date();
    await this.repository.update(id, { status: "ARCHIVED", archivedAt: now, resolvedAt: now }); // RF-17.12 resolución
    if (conversation.chatwootId) await chatwootProvider.resolve(conversation.chatwootId).catch(() => undefined);
  }

  // assertAccess => lo usa el gateway antes de unir un socket a la sala de la conversación
  public async assertAccess(id: string, viewer: Viewer): Promise<void> {
    await this.accessible(id, viewer);
  }

  // postMessage => mensaje del cliente o del agente; si la conversación sigue con el bot, responde la cadena del bot
  public async postMessage(id: string, content: string, viewer: Viewer, locale: Locale): Promise<MessageDto> {
    const conversation = await this.accessible(id, viewer);
    if (conversation.status === "ARCHIVED") throw new ConversationClosedException(conversation.status);
    const isOwner = conversation.userId === viewer.id;
    const message = await this.repository.pushMessage(id, isOwner ? "USER" : "AGENT", content, viewer.id);
    if (!isOwner) await this.repository.assignAgent(id, viewer.id);
    communicationEvents.emit("conversation.message", { conversationId: id, message });
    // RF-17.11 conversación atendida en Chatwoot: el mensaje se replica (cliente => incoming, agente del panel => outgoing)
    if (conversation.chatwootId) void chatwootProvider.forward(conversation.chatwootId, content, isOwner ? "incoming" : "outgoing").catch(() => undefined);
    // El bot responde en segundo plano ("void"): el emisor recibe su confirmación sin esperar al LLM
    if (isOwner && conversation.type === "AI" && conversation.status === "OPEN") {
      void this.botReply({ ...conversation, messages: [...conversation.messages, message] }, content, locale).catch((error: unknown) =>
        logger.error("chatbot_failed", { conversationId: id, error })
      );
    }
    return message;
  }

  // botReply => recorre la cadena hasta el primer manejador que responde
  private async botReply(conversation: ConversationDto, text: string, locale: Locale): Promise<void> {
    let reply: BotReply | null = null;
    const context: BotContext = { conversation, text, locale, messageId: conversation.messages.at(-1)?.id ?? "" };
    for (const handler of this.chain) {
      reply = await handler.handle(context);
      if (reply) break;
    }
    if (!reply) return;
    const message = await this.repository.pushMessage(conversation.id, "BOT", reply.text, null);
    communicationEvents.emit("conversation.message", { conversationId: conversation.id, message });
    if (reply.escalate) await this.escalate(conversation, reply.reason ?? "Escalado automático del bot");
  }

  private async escalate(conversation: ConversationDto, reason: string): Promise<ConversationDto> {
    const updated = await this.repository.update(conversation.id, { type: "HUMAN", status: "ESCALATED", escalationReason: reason, escalatedAt: new Date() });
    communicationEvents.emit("conversation.escalated", { conversationId: conversation.id, userId: conversation.userId, reason });
    // RF-17.11 se abre la conversación espejo en Chatwoot con el historial (asignación automática al agente)
    if (chatwootProvider.configured && !conversation.chatwootId) void this.mirrorToChatwoot(conversation, reason);
    return updated ?? conversation;
  }

  private async mirrorToChatwoot(conversation: ConversationDto, reason: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({ where: { id: conversation.userId }, select: { firstName: true, lastName: true, email: true } });
      if (!user) return;
      const fresh = (await this.repository.findById(conversation.id)) ?? conversation;
      const chatwootId = await chatwootProvider.openConversation({
        userId: conversation.userId,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        channel: conversation.channel,
        reason,
        transcript: fresh.messages.map((m) => ({ role: m.role, content: m.content })),
      });
      if (chatwootId) await this.repository.update(conversation.id, { chatwootId });
    } catch (error) {
      logger.warn("chatwoot_mirror_failed", { conversationId: conversation.id, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  // ---------- RF-17.11 hub de agentes (Chatwoot) ----------
  // handleChatwootWebhook => respuesta del agente (message_created outgoing, pública, no creada por la tienda) =>
  // mensaje AGENT en la conversación + evento en tiempo real; conversación resuelta => se archiva con resolvedAt
  public async handleChatwootWebhook(payload: { event: string; content?: string | null | undefined; message_type?: string | number | undefined; private?: boolean | undefined; status?: string | undefined; content_attributes?: Record<string, unknown> | null | undefined; sender?: { id?: string | number | undefined; name?: string | undefined } | null | undefined; conversation?: { id: string | number } | undefined; id?: string | number | undefined }): Promise<void> {
    const chatwootId = String(payload.conversation?.id ?? (payload.event === "conversation_status_changed" ? payload.id : "") ?? "");
    if (!chatwootId) return;
    const conversation = await this.repository.findByChatwootId(chatwootId);
    if (!conversation) return;
    const outgoing = payload.message_type === "outgoing" || payload.message_type === 1;
    if (payload.event === "message_created" && outgoing && !payload.private && payload.content && payload.content_attributes?.["source"] !== "store") {
      const message = await this.repository.pushMessage(conversation.id, "AGENT", payload.content.slice(0, 4000), `chatwoot:${payload.sender?.id ?? "agent"}`);
      await this.repository.assignAgent(conversation.id, `chatwoot:${payload.sender?.id ?? "agent"}`);
      communicationEvents.emit("conversation.message", { conversationId: conversation.id, message });
    }
    if (payload.event === "conversation_status_changed" && payload.status === "resolved") {
      const now = new Date();
      await this.repository.update(conversation.id, { status: "ARCHIVED", archivedAt: now, resolvedAt: now });
    }
  }

  public async assign(id: string, viewer: Viewer, assigneeId?: number): Promise<ConversationDto> {
    const conversation = await this.accessible(id, viewer);
    if (conversation.chatwootId) {
      // Manual (id de agente de Chatwoot) o automática (round robin)
      await (assigneeId ? chatwootProvider.assign(conversation.chatwootId, assigneeId) : chatwootProvider.autoAssign(conversation.chatwootId));
    } else {
      await this.repository.assignAgent(id, viewer.id); // Sin Chatwoot: lo toma el agente del panel
    }
    return (await this.repository.findById(id)) ?? conversation;
  }

  public cannedResponses(): Promise<CannedResponse[]> {
    return chatwootProvider.cannedResponses();
  }

  public createCannedResponse(shortCode: string, content: string): Promise<CannedResponse> {
    return chatwootProvider.createCannedResponse(shortCode, content);
  }

  public agents(): Promise<Array<{ id: number; name: string; availability: string }>> {
    return chatwootProvider.agents();
  }

  // metrics => RF-17.12 tiempos de respuesta y resolución + precisión de intenciones/entidades (FastAPI)
  public async metrics(days: number): Promise<SupportMetricsDto> {
    const [base, nlu] = await Promise.all([
      this.repository.metrics(days),
      axios
        .get<{ data: Record<string, unknown> }>(`${appConfig.FASTAPI_URL}/api/v1/ml/nlp/metrics`, { timeout: 30_000, headers: { Authorization: `Bearer ${signServiceToken()}` } })
        .then((response) => response.data.data)
        .catch(() => null),
    ]);
    return { ...base, nlu };
  }

  // accessible => dueño o agente (admin); si no, 404 (no se revela que existe)
  private async accessible(id: string, viewer: Viewer): Promise<ConversationDto> {
    const conversation = await this.repository.findById(id);
    if (!conversation || (conversation.userId !== viewer.id && !isAdmin(viewer))) throw new ConversationNotFoundException(id);
    return conversation;
  }
}

export const communicationService = new CommunicationService(communicationRepository);
