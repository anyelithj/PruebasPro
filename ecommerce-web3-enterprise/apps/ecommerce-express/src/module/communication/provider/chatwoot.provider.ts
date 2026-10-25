// chatwoot.provider.ts (Express · axios) => RF-17.11 hub unificado de agentes humanos con Chatwoot (open source).
// Cuando el bot escala, la conversación se replica en Chatwoot (contacto + conversación + historial) y desde ahí los
// agentes atienden chat web y correo en una sola bandeja, con asignación manual o automática y respuestas rápidas
// (canned responses). Lo que responde el agente vuelve a la tienda por el webhook de Chatwoot.
// Patrones: Adapter (traduce el dominio a la API REST v1 de Chatwoot), Null Object (sin configuración => no hace nada
// y la tienda sigue con su bandeja propia) y Round Robin (asignación automática entre agentes en línea).
// Paradigma: POO + asíncrono. Sin SDK: API REST con header "api_access_token" (axios ya instalado).
import axios, { type AxiosInstance } from "axios";
import { appConfig } from "../../../config/app.config";
import { redis } from "../../../config/redis.config";
import { logger } from "../../../shared/middleware/logger.middleware";

export interface CannedResponse {
  id: number | string;
  shortCode: string;
  content: string;
}

// DEFAULT_CANNED => respuestas rápidas de respaldo (sin Chatwoot el panel propio igual ofrece plantillas)
export const DEFAULT_CANNED: CannedResponse[] = [
  { id: "greeting", shortCode: "saludo", content: "¡Hola! Soy {{agente}} del equipo de soporte. ¿En qué te puedo ayudar?" },
  { id: "order", shortCode: "pedido", content: "Ya revisé tu pedido: está en camino y te llegará el número de guía por correo." },
  { id: "refund", shortCode: "devolucion", content: "Puedes solicitar la devolución desde Mi cuenta > Pedidos; te enviamos la etiqueta en PDF." },
  { id: "closing", shortCode: "cierre", content: "¿Hay algo más en lo que te pueda ayudar? ¡Gracias por escribirnos!" },
];

export class ChatwootProvider {
  private readonly http: AxiosInstance | null;

  constructor() {
    const { CHATWOOT_URL, CHATWOOT_API_TOKEN, CHATWOOT_ACCOUNT_ID } = appConfig;
    // Null Object: sin las tres variables no se crea el cliente y cada método termina sin efecto
    this.http =
      CHATWOOT_URL && CHATWOOT_API_TOKEN && CHATWOOT_ACCOUNT_ID
        ? axios.create({ baseURL: `${CHATWOOT_URL.replace(/\/$/, "")}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}`, headers: { api_access_token: CHATWOOT_API_TOKEN }, timeout: 8000 })
        : null;
  }

  public get configured(): boolean {
    return this.http !== null && Boolean(appConfig.CHATWOOT_INBOX_ID);
  }

  // openConversation => contacto (identificado por el id del cliente) + conversación en la bandeja API + historial.
  // Devuelve el id de la conversación en Chatwoot (se guarda para enrutar las respuestas del webhook)
  public async openConversation(input: {
    userId: string;
    name: string;
    email: string;
    channel: string;
    reason: string;
    transcript: Array<{ role: string; content: string }>;
  }): Promise<string | null> {
    if (!this.http || !appConfig.CHATWOOT_INBOX_ID) return null;
    const inboxId = Number(appConfig.CHATWOOT_INBOX_ID);
    const { data: contact } = await this.http.post<{ payload: { contact: { id: number }; contact_inbox?: { source_id: string } } }>("/contacts", {
      inbox_id: inboxId,
      name: input.name,
      email: input.email,
      identifier: input.userId, // Evita contactos duplicados del mismo cliente
    }).catch(async () => {
      // 422 => el contacto ya existe: se busca por el identificador
      const { data } = await this.http!.get<{ payload: Array<{ id: number }> }>("/contacts/search", { params: { q: input.email } });
      return { data: { payload: { contact: { id: data.payload[0]?.id ?? 0 } } } };
    });
    const { data: conversation } = await this.http.post<{ id: number }>("/conversations", {
      inbox_id: inboxId,
      contact_id: contact.payload.contact.id,
      custom_attributes: { store_channel: input.channel, escalation_reason: input.reason },
      additional_attributes: { store_user_id: input.userId },
    });
    // Historial: los mensajes del cliente como "incoming" y los del bot como notas privadas (el agente ve el contexto)
    for (const message of input.transcript.slice(-30)) {
      await this.http.post(`/conversations/${conversation.id}/messages`, {
        content: message.role === "USER" ? message.content : `🤖 ${message.content}`,
        message_type: message.role === "USER" ? "incoming" : "outgoing",
        private: message.role !== "USER",
        content_attributes: { source: "store" },
      });
    }
    await this.autoAssign(conversation.id);
    return String(conversation.id);
  }

  // forward => mensaje nuevo del cliente (incoming) o de un agente desde el panel propio (outgoing). "source: store"
  // marca los mensajes que creó la tienda para ignorar su eco en el webhook
  public async forward(chatwootId: string, content: string, direction: "incoming" | "outgoing"): Promise<void> {
    if (!this.http) return;
    await this.http.post(`/conversations/${chatwootId}/messages`, { content, message_type: direction, private: false, content_attributes: { source: "store" } });
  }

  // assign => asignación MANUAL a un agente concreto de Chatwoot
  public async assign(chatwootId: string, assigneeId: number): Promise<void> {
    if (!this.http) return;
    await this.http.post(`/conversations/${chatwootId}/assignments`, { assignee_id: assigneeId });
  }

  // autoAssign => asignación AUTOMÁTICA round robin entre agentes en línea (contador en Redis compartido por réplicas)
  public async autoAssign(chatwootId: string | number): Promise<void> {
    if (!this.http) return;
    try {
      const { data: agents } = await this.http.get<Array<{ id: number; availability_status: string }>>("/agents");
      const online = agents.filter((agent) => agent.availability_status === "online");
      const pool = online.length ? online : agents;
      if (pool.length === 0) return;
      const turn = await redis.incr("chatwoot:round-robin").catch(() => Date.now());
      await this.assign(String(chatwootId), pool[turn % pool.length]!.id);
    } catch (error) {
      logger.warn("chatwoot_auto_assign_failed", { chatwootId, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  public async agents(): Promise<Array<{ id: number; name: string; availability: string }>> {
    if (!this.http) return [];
    const { data } = await this.http.get<Array<{ id: number; name: string; availability_status: string }>>("/agents");
    return data.map((agent) => ({ id: agent.id, name: agent.name, availability: agent.availability_status }));
  }

  // cannedResponses => plantillas de respuestas rápidas de Chatwoot (o las de respaldo)
  public async cannedResponses(): Promise<CannedResponse[]> {
    if (!this.http) return DEFAULT_CANNED;
    const { data } = await this.http.get<Array<{ id: number; short_code: string; content: string }>>("/canned_responses");
    return data.map((row) => ({ id: row.id, shortCode: row.short_code, content: row.content }));
  }

  public async createCannedResponse(shortCode: string, content: string): Promise<CannedResponse> {
    if (!this.http) return { id: shortCode, shortCode, content };
    const { data } = await this.http.post<{ id: number; short_code: string; content: string }>("/canned_responses", { short_code: shortCode, content });
    return { id: data.id, shortCode: data.short_code, content: data.content };
  }

  public async resolve(chatwootId: string): Promise<void> {
    if (!this.http) return;
    await this.http.post(`/conversations/${chatwootId}/toggle_status`, { status: "resolved" });
  }
}

export const chatwootProvider = new ChatwootProvider();
