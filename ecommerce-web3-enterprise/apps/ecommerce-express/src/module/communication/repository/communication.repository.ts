// communication.repository.ts => conversaciones en MongoDB (Mongoose). Escrituras atómicas con operadores de Mongo
// ($push + $slice) => sin leer-modificar-escribir: dos mensajes simultáneos nunca se pisan.
import { Types } from "mongoose";
import { ConversationModel, MAX_MESSAGES, type Channel, type ConversationStatus, type ConversationType, type MessageRole } from "../model/communication.model";
import type { ConversationDto, ConversationSummaryDto, MessageDto, NluInfo, SupportMetricsDto } from "../dto/communication.dto";
import type { PageParams, Paginated } from "../../../shared/types/pagination.types";

export interface ConversationFilter {
  userId?: string | undefined;
  channel?: Channel | undefined;
  statuses: ConversationStatus[];
}

type ConversationSet = Partial<Pick<ConversationDto, "type" | "status" | "agentId" | "escalationReason" | "chatwootId">> & { escalatedAt?: Date; archivedAt?: Date; resolvedAt?: Date; lowConfidenceStreak?: number };

export class CommunicationRepository {
  public async create(userId: string, type: ConversationType, channel: Channel): Promise<ConversationDto> {
    return toConversation(await ConversationModel.create({ userId, type, channel }));
  }

  public async findById(id: string): Promise<ConversationDto | null> {
    const doc = await ConversationModel.findById(id).lean();
    return doc ? toConversation(doc) : null;
  }

  // findMany => bandeja paginada; "$slice: -1" proyecta SOLO el último mensaje (listado liviano)
  public async findMany(filter: ConversationFilter, page: PageParams): Promise<Paginated<ConversationSummaryDto>> {
    const where = { status: { $in: filter.statuses }, ...(filter.userId ? { userId: filter.userId } : {}), ...(filter.channel ? { channel: filter.channel } : {}) };
    const [docs, total] = await Promise.all([
      ConversationModel.find(where, { messages: { $slice: -1 } }).sort({ lastMessageAt: -1 }).skip(page.skip).limit(page.limit).lean(),
      ConversationModel.countDocuments(where),
    ]);
    const items = docs.map((doc) => {
      const conversation = toConversation(doc);
      return { ...omitMessages(conversation), lastMessage: conversation.messages.at(-1) ?? null };
    });
    return { items, total };
  }

  // pushMessage => agrega el mensaje y recorta a los últimos MAX_MESSAGES en UNA operación atómica
  public async pushMessage(id: string, role: MessageRole, content: string, authorId: string | null): Promise<MessageDto> {
    const message = { _id: new Types.ObjectId(), role, content, authorId, createdAt: new Date() };
    await ConversationModel.updateOne({ _id: id }, { $push: { messages: { $each: [message], $slice: -MAX_MESSAGES } }, $set: { lastMessageAt: message.createdAt } });
    return toMessage(message);
  }

  // setNlu => RF-17.2 guarda la comprensión en el mensaje exacto (operador posicional "$": atómico)
  public async setNlu(id: string, messageId: string, nlu: NluInfo): Promise<void> {
    await ConversationModel.updateOne({ _id: id, "messages._id": messageId }, { $set: { "messages.$.nlu": nlu } });
  }

  // bumpLowConfidence => RF-17.10 suma (o reinicia) la racha de mensajes no entendidos y devuelve el valor nuevo
  public async bumpLowConfidence(id: string, low: boolean): Promise<number> {
    const doc = await ConversationModel.findByIdAndUpdate(id, low ? { $inc: { lowConfidenceStreak: 1 } } : { $set: { lowConfidenceStreak: 0 } }, { new: true, projection: { lowConfidenceStreak: 1 } }).lean();
    return doc?.lowConfidenceStreak ?? 0;
  }

  public async findByChatwootId(chatwootId: string): Promise<ConversationDto | null> {
    const doc = await ConversationModel.findOne({ chatwootId }).lean();
    return doc ? toConversation(doc) : null;
  }

  // metrics => RF-17.12 tiempos sobre las conversaciones del período (máx. 5000: cálculo en memoria, legible)
  public async metrics(days: number): Promise<Omit<SupportMetricsDto, "nlu">> {
    const since = new Date(Date.now() - days * 86_400_000);
    const docs = await ConversationModel.find({ createdAt: { $gte: since } }, { messages: 1, escalatedAt: 1, resolvedAt: 1, createdAt: 1, escalationReason: 1 }).limit(5000).lean();
    const first: number[] = [];
    const agent: number[] = [];
    const resolution: number[] = [];
    const intents: Record<string, number> = {};
    let escalated = 0;
    let lowConfidence = 0;
    for (const doc of docs) {
      const messages = doc.messages ?? [];
      const firstUser = messages.find((m) => m.role === "USER");
      const reply = firstUser && messages.find((m) => m.role !== "USER" && (m.createdAt ?? 0) >= (firstUser.createdAt ?? 0));
      if (firstUser?.createdAt && reply?.createdAt) first.push(reply.createdAt.getTime() - firstUser.createdAt.getTime());
      if (doc.escalatedAt) {
        escalated += 1;
        if (doc.escalationReason?.startsWith("Baja confianza")) lowConfidence += 1;
        const agentReply = messages.find((m) => m.role === "AGENT" && (m.createdAt ?? 0) >= doc.escalatedAt!);
        if (agentReply?.createdAt) agent.push(agentReply.createdAt.getTime() - doc.escalatedAt.getTime());
      }
      if (doc.resolvedAt && doc.createdAt) resolution.push(doc.resolvedAt.getTime() - doc.createdAt.getTime());
      for (const message of messages) {
        const intent = (message.nlu as NluInfo | null | undefined)?.intent;
        if (intent) intents[intent] = (intents[intent] ?? 0) + 1;
      }
    }
    const avg = (values: number[], unitMs: number) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length / unitMs) : null);
    return {
      days,
      conversations: docs.length,
      escalated,
      escalationRate: docs.length ? Math.round((escalated / docs.length) * 1000) / 1000 : 0,
      lowConfidenceEscalations: lowConfidence,
      avgFirstResponseSeconds: avg(first, 1000),
      avgAgentResponseSeconds: avg(agent, 1000),
      avgResolutionMinutes: avg(resolution, 60_000),
      resolved: resolution.length,
      intents,
    };
  }

  // assignAgent => fija el agente solo si aún no tiene uno (condición en el filtro: atómico)
  public async assignAgent(id: string, agentId: string): Promise<void> {
    await ConversationModel.updateOne({ _id: id, agentId: null }, { $set: { agentId } });
  }

  public async update(id: string, changes: ConversationSet): Promise<ConversationDto | null> {
    const doc = await ConversationModel.findByIdAndUpdate(id, { $set: changes }, { new: true }).lean();
    return doc ? toConversation(doc) : null;
  }
}

interface MessageDoc {
  _id: unknown;
  role: string;
  authorId?: string | null | undefined;
  content: string;
  createdAt?: Date | undefined;
  nlu?: unknown;
}

const toMessage = (doc: MessageDoc): MessageDto => ({
  id: String(doc._id),
  role: doc.role as MessageRole,
  authorId: doc.authorId ?? null,
  content: doc.content,
  createdAt: doc.createdAt ?? new Date(),
  nlu: (doc.nlu as NluInfo | null | undefined) ?? null,
});

// "_" => descarta "messages" con desestructuración (programación funcional, sin mutar)
const omitMessages = ({ messages: _messages, ...rest }: ConversationDto): Omit<ConversationDto, "messages"> => rest;

function toConversation(doc: {
  _id: unknown;
  userId: string;
  type?: string | null | undefined;
  channel?: string | null | undefined;
  status?: string | null | undefined;
  agentId?: string | null | undefined;
  escalationReason?: string | null | undefined;
  chatwootId?: string | null | undefined;
  resolvedAt?: Date | null | undefined;
  lastMessageAt?: Date | null | undefined;
  createdAt?: Date | undefined;
  messages?: MessageDoc[] | null | undefined;
}): ConversationDto {
  return {
    id: String(doc._id),
    userId: doc.userId,
    type: (doc.type ?? "AI") as ConversationType,
    channel: (doc.channel ?? "WEB") as Channel,
    status: (doc.status ?? "OPEN") as ConversationStatus,
    agentId: doc.agentId ?? null,
    escalationReason: doc.escalationReason ?? null,
    chatwootId: doc.chatwootId ?? null,
    resolvedAt: doc.resolvedAt ?? null,
    lastMessageAt: doc.lastMessageAt ?? new Date(),
    createdAt: doc.createdAt ?? new Date(),
    messages: (doc.messages ?? []).map(toMessage),
  };
}

export const communicationRepository = new CommunicationRepository();
