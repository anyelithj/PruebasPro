import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AssistantClientService,
  type ChatResult,
  type GuideInput,
} from '../../../ai/assistant-client.service';
import type { Role } from '../../../users/domain/value-objects/role.vo';
import { Faq } from '../../domain/entities/faq.entity';
import { ManualArticle } from '../../domain/entities/manual-article.entity';
import { answerWithoutLlm } from '../../domain/guide-fallback';
import { visibleRoles } from './list-manual.use-case';
// [UseCase AskGuide · Sprint 7.10 · RF-96]: pregunta al Agente Guía (persona «guide» de FastAPI) con la pantalla y el idioma de la interfaz | [Patrón]: Use Case + Proxy (JSON y SSE) | [Principio]: SRP + DIP + DRY (el mismo AssistantClientService del tutor) | [Paradigma]: POO + async/await
// [Seguridad]: el rol NO viaja en el cuerpo — FastAPI lo lee del mismo JWT → nadie pide el manual de ADMIN fingiendo serlo · límite de peticiones en el controlador
// [Modo degradado · 2026-10-27]: si FastAPI (o Ollama detrás) no responde, ya NO se devuelve 503 → se responde desde PostgreSQL (FAQ publicadas + manual del rol)
// con búsqueda léxica (domain/guide-fallback.ts) y `degraded: true` → la UI muestra un aviso suave | [Patrón]: Fallback + Circuit-less Graceful Degradation | [Principio]: Fail Soft (nunca solo un error)

// [GuideResult]: lo de FastAPI + `degraded` (true = respondido sin IA)
export type GuideResult = ChatResult & { degraded?: boolean };

@Injectable()
export class AskGuideUseCase {
  private readonly logger = new Logger(AskGuideUseCase.name);

  constructor(
    private readonly assistant: AssistantClientService,
    @InjectRepository(Faq) private readonly faqs: Repository<Faq>,
    @InjectRepository(ManualArticle)
    private readonly articles: Repository<ManualArticle>,
  ) {}

  // `role` (JWT de NestJS): solo para el modo degradado — FastAPI sigue leyendo el rol de su propio JWT
  async execute(input: GuideInput, token: string, role: Role): Promise<GuideResult> {
    try {
      return await this.assistant.guide(input, token);
    } catch (err) {
      if (!(err instanceof ServiceUnavailableException)) throw err; // 404 de conversación ajena, etc. → se respetan
      return this.fallback(input, role);
    }
  }

  // [stream]: eventos session → token… → sources → done (el controlador los canaliza sin buffer) | sin FastAPI → el MISMO protocolo SSE generado aquí
  async stream(
    input: GuideInput,
    token: string,
    signal: AbortSignal,
    role: Role,
  ): Promise<Readable> {
    try {
      return await this.assistant.guideStream(input, token, signal);
    } catch (err) {
      if (!(err instanceof ServiceUnavailableException)) throw err;
      return toSse(await this.fallback(input, role));
    }
  }

  // [fallback]: FAQ y manual visibles para el rol, en el idioma de la interfaz → respuesta con citas (o «no lo sé» amable) | si la BD también falla, «no lo sé» igualmente
  private async fallback(input: GuideInput, role: Role): Promise<GuideResult> {
    this.logger.warn(`Agente Guía en modo degradado (sin IA) · modo ${input.mode ?? 'guide'}`);
    const roles = visibleRoles(role);
    const [faqs, articles] = await Promise.all([
      this.faqs.find({
        where: { status: 'published', locale: input.locale, role: In(roles) },
        select: { id: true, question: true, answer: true, manualSlug: true },
      }),
      this.articles.find({
        where: { locale: input.locale, role: In(roles) },
        select: { slug: true, title: true, body: true },
      }),
    ]).catch((e: unknown) => {
      this.logger.error(`Modo degradado sin BD: ${e instanceof Error ? e.message : String(e)}`);
      return [[], []] as [Faq[], ManualArticle[]];
    });
    const answer = answerWithoutLlm(input.message, input.locale, input.mode ?? 'guide', faqs, articles);
    const now = new Date().toISOString();
    return {
      session_id: input.sessionId ?? randomUUID(), // `randomUUID` (node:crypto): id válido para la UI; FastAPI empezará otra conversación al volver
      reply: answer.reply,
      history: [
        { role: 'user', content: input.message, timestamp: now },
        { role: 'assistant', content: answer.reply, timestamp: now },
      ],
      sources: answer.sources,
      answered_by: answer.answeredBy,
      degraded: true,
    };
  }
}

// [toSse]: respuesta completa → flujo SSE idéntico al de FastAPI (session · token por palabra · sources · done) | `Readable.from` (Node): iterable → stream
// [Patrón]: Adapter (JSON → SSE) | [Principio]: OCP (la UI no distingue el origen salvo por `degraded`)
export function toSse(r: GuideResult): Readable {
  const ev = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const words = r.reply.match(/\S+\s*/g) ?? []; // Misma partición que FastAPI (`\S+\s*`) → se conservan los saltos de línea
  return Readable.from([
    ev('session', { session_id: r.session_id }),
    ...words.map((text) => ev('token', { text })),
    ev('sources', { sources: r.sources ?? [], answered_by: r.answered_by ?? 'none', degraded: !!r.degraded }),
    ev('done', {}),
  ]);
}
