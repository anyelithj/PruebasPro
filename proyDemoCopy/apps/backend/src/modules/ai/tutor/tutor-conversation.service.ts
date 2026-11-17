import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, type Repository } from 'typeorm';
import {
  AssistantClientService,
  type HistoryTurn,
} from '../assistant-client.service';
import {
  TUTOR_TITLE_MAX,
  TutorConversation,
  type LanguageUsage,
} from './tutor-conversation.entity';
import { TutorMessage, type TutorRole } from './tutor-message.entity';
// [TutorConversationService · 2026-10-28]: casos de uso del Tutor IA — enviar mensaje, listar/leer/renombrar/borrar conversación y editar/borrar mensaje | [Patrón]: Application Service + Repository (TypeORM) + Proxy (FastAPI sin estado) | [Principio]: SRP (un agregado) + mínimo privilegio (todo filtra por user_id; ajena = 404 sin revelar que existe) + Fail Safe (el LLM responde ANTES de escribir → un fallo no deja la conversación a medias) | [Paradigma]: POO + async/await

const TITLE_AUTO_MAX = 60; // Título automático = inicio del primer mensaje (el alumno puede renombrarlo hasta TUTOR_TITLE_MAX)
const LIST_LIMIT = 50; // [Paginación simple]: las 50 más recientes en la barra lateral
const DEFAULTS = { language: 'en', level: 'A2' } as const; // Mismos valores por defecto que la pantalla /tutor

// [DTOs de salida]: camelCase y fechas ISO → contrato estable para Angular (Zod en el cliente)
export interface TutorConversationSummary {
  id: string;
  title: string;
  language: string;
  level: string;
  languageUsage: LanguageUsage | null;
  createdAt: string;
  updatedAt: string;
}
export interface TutorMessageView {
  id: string;
  role: TutorRole;
  content: string;
  createdAt: string;
  editedAt: string | null;
}
export interface TutorConversationDetail extends TutorConversationSummary {
  messages: TutorMessageView[];
}
export interface TutorTurnResult {
  conversation: TutorConversationSummary;
  userMessage: TutorMessageView;
  assistantMessage: TutorMessageView;
}
export interface TutorSendInput {
  message: string;
  sessionId?: string; // = id de la conversación (nombre heredado del contrato SSE)
  language?: string;
  level?: string;
}

// [Mappers puros]: entidad → DTO | [Patrón]: Mapper | [Principio]: DRY
const toSummary = (c: TutorConversation): TutorConversationSummary => ({
  id: c.id,
  title: c.title,
  language: c.language,
  level: c.level,
  languageUsage: c.languageUsage,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});
const toView = (m: TutorMessage): TutorMessageView => ({
  id: m.id,
  role: m.role,
  content: m.content,
  createdAt: m.createdAt.toISOString(),
  editedAt: m.editedAt?.toISOString() ?? null, // `?.` (ES2020): null si nunca se editó
});
const toTurn = (m: TutorMessage): HistoryTurn => ({ role: m.role, content: m.content });

// [titleFrom]: primera línea del mensaje, espacios simples, máx. 60 caracteres con «…» | Función pura (exportada para tests)
export function titleFrom(message: string): string {
  const line = message.trim().split('\n')[0].replace(/\s+/g, ' ');
  return line.length > TITLE_AUTO_MAX ? `${line.slice(0, TITLE_AUTO_MAX - 1).trimEnd()}…` : line || 'Conversación';
}

@Injectable()
export class TutorConversationService {
  private readonly logger = new Logger(TutorConversationService.name);

  constructor(
    @InjectRepository(TutorConversation)
    private readonly conversations: Repository<TutorConversation>,
    @InjectRepository(TutorMessage)
    private readonly messages: Repository<TutorMessage>,
    private readonly assistant: AssistantClientService,
  ) {}

  async list(userId: string): Promise<TutorConversationSummary[]> {
    const rows = await this.conversations.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
      take: LIST_LIMIT,
    });
    return rows.map(toSummary);
  }

  async get(userId: string, id: string): Promise<TutorConversationDetail> {
    const conv = await this.owned(userId, id);
    return this.detail(conv);
  }

  async rename(userId: string, id: string, title: string): Promise<TutorConversationSummary> {
    const clean = title.trim().replace(/\s+/g, ' ').slice(0, TUTOR_TITLE_MAX);
    if (!clean) throw new BadRequestException('El título no puede estar vacío');
    const conv = await this.owned(userId, id);
    conv.title = clean;
    return toSummary(await this.conversations.save(conv));
  }

  async remove(userId: string, id: string): Promise<{ deleted: true }> {
    const conv = await this.owned(userId, id);
    await this.conversations.delete({ id: conv.id, userId }); // FK ON DELETE CASCADE → borra también sus mensajes
    return { deleted: true };
  }

  // [send]: nueva conversación (sin sessionId) o continúa una propia → FastAPI responde con el historial guardado → se guardan los dos turnos
  async send(userId: string, token: string, input: TutorSendInput): Promise<TutorTurnResult> {
    const existing = input.sessionId ? await this.owned(userId, input.sessionId) : null;
    const conv =
      existing ??
      this.conversations.create({
        id: randomUUID(), // `randomUUID` (node:crypto): el id viaja a FastAPI antes de existir en la BD
        userId,
        title: titleFrom(input.message),
        languageUsage: null,
      });
    conv.language = input.language ?? existing?.language ?? DEFAULTS.language;
    conv.level = input.level ?? existing?.level ?? DEFAULTS.level;
    const history = existing ? await this.ordered(conv.id) : [];

    const result = await this.ask(conv, input.message, history, token); // Si FastAPI falla, nada se ha escrito
    const seq = (history.at(-1)?.seq ?? 0) + 1;
    const [userMessage, assistantMessage] = await this.conversations.manager.transaction(async (em) => {
      conv.languageUsage = result.language_usage ?? null;
      conv.updatedAt = new Date(); // Sube la conversación al principio de la lista aunque no cambie nada más
      await em.save(conv);
      return em.save([
        em.create(TutorMessage, { conversationId: conv.id, seq, role: 'user', content: input.message, editedAt: null }),
        em.create(TutorMessage, { conversationId: conv.id, seq: seq + 1, role: 'assistant', content: result.reply, editedAt: null }),
      ]);
    });
    return { conversation: toSummary(conv), userMessage: toView(userMessage), assistantMessage: toView(assistantMessage) };
  }

  // [editMessage]: solo mensajes del alumno → se descarta lo posterior y el tutor vuelve a responder (como «editar» en un chat de IA)
  async editMessage(userId: string, token: string, id: string, messageId: string, content: string): Promise<TutorConversationDetail> {
    const text = content.trim();
    if (!text) throw new BadRequestException('El mensaje no puede estar vacío');
    const conv = await this.owned(userId, id);
    const all = await this.ordered(conv.id);
    const target = this.find(all, messageId);
    if (target.role !== 'user') throw new BadRequestException('Solo puedes editar tus propios mensajes');

    const result = await this.ask(conv, text, all.filter((m) => m.seq < target.seq), token); // LLM antes de escribir (atómico)
    await this.conversations.manager.transaction(async (em) => {
      await em.delete(TutorMessage, { conversationId: conv.id, seq: MoreThan(target.seq) }); // Trunca lo que venía después
      target.content = text;
      target.editedAt = new Date();
      await em.save(target);
      await em.save(em.create(TutorMessage, { conversationId: conv.id, seq: target.seq + 1, role: 'assistant', content: result.reply, editedAt: null }));
      conv.languageUsage = result.language_usage ?? null;
      conv.updatedAt = new Date();
      await em.save(conv);
    });
    return this.detail(conv);
  }

  // [deleteMessage]: borra UN mensaje (del alumno o del tutor) y recalcula el uso del idioma con lo que queda
  async deleteMessage(userId: string, token: string, id: string, messageId: string): Promise<TutorConversationDetail> {
    const conv = await this.owned(userId, id);
    const all = await this.ordered(conv.id);
    const target = this.find(all, messageId);
    await this.messages.delete({ id: target.id, conversationId: conv.id });
    conv.languageUsage = await this.recompute(conv, all.filter((m) => m.id !== target.id), token);
    conv.updatedAt = new Date();
    await this.conversations.save(conv);
    return this.detail(conv);
  }

  // ───── privados ─────

  // [owned]: conversación del usuario o 404 (la de otro «no existe») | [Principio]: mínimo privilegio
  private async owned(userId: string, id: string): Promise<TutorConversation> {
    const conv = await this.conversations.findOne({ where: { id, userId } });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    return conv;
  }

  private ordered(conversationId: string): Promise<TutorMessage[]> {
    return this.messages.find({ where: { conversationId }, order: { seq: 'ASC' } });
  }

  private find(all: TutorMessage[], messageId: string): TutorMessage {
    const msg = all.find((m) => m.id === messageId);
    if (!msg) throw new NotFoundException('Mensaje no encontrado');
    return msg;
  }

  private async detail(conv: TutorConversation): Promise<TutorConversationDetail> {
    return { ...toSummary(conv), messages: (await this.ordered(conv.id)).map(toView) };
  }

  // [ask]: FastAPI en modo sin estado (persona «tutor» por defecto) con el historial que guarda NestJS
  private ask(conv: TutorConversation, message: string, history: TutorMessage[], token: string) {
    return this.assistant.chat(
      { message, sessionId: conv.id, language: conv.language, level: conv.level, history: history.map(toTurn) },
      token,
    );
  }

  // [recompute]: % en el idioma meta sin LLM · si FastAPI no está se conserva el valor anterior | [Principio]: Fail Soft
  private async recompute(conv: TutorConversation, rest: TutorMessage[], token: string): Promise<LanguageUsage | null> {
    if (conv.language === 'es') return null; // Estudiar español: no hay «idioma meta» distinto del de la interfaz
    try {
      return await this.assistant.languageUsage({ messages: rest.map(toTurn), language: conv.language, level: conv.level }, token);
    } catch (err) {
      this.logger.warn(`No se pudo recalcular el uso del idioma: ${err instanceof Error ? err.message : String(err)}`);
      return conv.languageUsage;
    }
  }
}
