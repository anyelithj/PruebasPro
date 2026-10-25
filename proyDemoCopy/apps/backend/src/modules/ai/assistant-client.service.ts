import type { Readable } from 'stream';
import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { CefrLevel } from '../../shared/domain/cefr-level.vo';
import type { Language } from '../../shared/domain/language.vo';
// [AssistantClientService · Sprints 5.3/7.10]: cliente HTTP ÚNICO al Assistant de FastAPI (/api/v1/assistant/*) — tutor RAG, persona «guide» del Agente Guía (Help), persona «game» (Games, Sprint 8.7) y persona «dialogue» (Dialogues, Sprint 9.6) | [Patrón]: Adapter | [Principio]: SRP (separado de AIClientService: otro servicio remoto, otros tiempos) + DRY (Help no crea otro cliente) | [Paradigma]: POO

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
export interface ChatResult {
  session_id: string;
  reply: string;
  history: ChatTurn[];
  sources?: GuideSource[]; // [Sprint 7.10]: citas del Agente Guía (vacío en el tutor)
  answered_by?: 'faq' | 'manual' | 'llm' | 'engine' | 'none'; // [Sprint 8.7]: «engine» = motor determinista del juego
  game?: Record<string, unknown> | null; // [Sprint 8.7]: eventos de la partida (solved, violation, met, finished…)
  dialogue?: Record<string, unknown> | null; // [Sprint 9.6]: vocabulario del tema usado y corrección suave del avatar
}
export interface GuideSource {
  kind: 'faq' | 'manual';
  id: string;
  title: string;
  ref: string | null;
}
// [GuideInput · Sprint 7.10]: pregunta al Agente Guía con la pantalla actual; el rol lo pone FastAPI desde el JWT
export interface GuideInput {
  message: string;
  sessionId?: string;
  route?: string;
  locale: 'es' | 'en';
  // [2026-10-19 · chatbot con modos]: guía (por defecto) · soporte · tutor (con el idioma y nivel que estudia)
  mode?: 'guide' | 'support' | 'tutor';
  language?: string;
  level?: string;
}
export interface Conversation {
  id: string;
  user_id: string;
  messages: ChatTurn[];
  created_at: string;
}
export interface KnowledgeStatus {
  available: boolean;
  documents: number;
}

@Injectable()
export class AssistantClientService {
  private readonly logger = new Logger(AssistantClientService.name);
  private readonly baseUrl = `${(process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')}/api/v1/assistant`;

  constructor(private readonly http: HttpService) {}

  // `private async` (TS): única puerta HTTP del cliente → mismo manejo de errores en las tres rutas | [Principio]: DRY
  private async call<T>(
    method: 'get' | 'post' | 'delete',
    path: string,
    token: string,
    body?: unknown,
    timeout = 15_000,
  ): Promise<T> {
    try {
      const res = await firstValueFrom(
        this.http.request<T>({
          method,
          url: `${this.baseUrl}${path}`,
          data: body,
          timeout,
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return res.data;
    } catch (err) {
      this.logger.warn(
        `Assistant ${path} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Sin respuesta inventada: el tutor no está → 503 y la UI lo explica
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 404)
        throw new NotFoundException('Conversación no encontrada'); // [Sprint 7.10]: conversación ajena o caducada
      throw new ServiceUnavailableException(
        status === 503
          ? 'Modelo de embeddings no disponible'
          : 'El tutor no está disponible en este momento',
      );
    }
  }

  // [chat]: 90 s → el LLM local en CPU puede tardar la primera vez (carga del modelo)
  chat(
    input: {
      message: string;
      sessionId?: string;
      language?: Language;
      level?: CefrLevel;
    },
    token: string,
  ): Promise<ChatResult> {
    return this.call(
      'post',
      '/chat',
      token,
      {
        message: input.message,
        session_id: input.sessionId ?? null,
        language: input.language ?? null,
        level: input.level ?? null,
      },
      90_000,
    );
  }

  // [chatStream · Sprint 5.3]: SSE de FastAPI (eventos session/token/done) como flujo de bytes → el controlador lo canaliza sin buffer | `responseType: 'stream'` (axios)
  async chatStream(
    input: {
      message: string;
      sessionId?: string;
      language?: Language;
      level?: CefrLevel;
    },
    token: string,
    signal: AbortSignal,
  ): Promise<Readable> {
    try {
      const res = await firstValueFrom(
        this.http.post<Readable>(
          `${this.baseUrl}/chat/stream`,
          {
            message: input.message,
            session_id: input.sessionId ?? null,
            language: input.language ?? null,
            level: input.level ?? null,
          },
          {
            responseType: 'stream',
            timeout: 90_000,
            signal, // [Cancelación]: si el navegador cierra la conexión, se corta también la petición a FastAPI
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      );
      return res.data;
    } catch (err) {
      this.logger.warn(
        `Assistant /chat/stream failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'El tutor no está disponible en este momento',
      );
    }
  }

  knowledge(token: string): Promise<KnowledgeStatus> {
    return this.call('get', '/knowledge', token);
  }

  // [reindex]: recodifica todos los recursos aprobados → puede tardar
  reindex(
    token: string,
  ): Promise<{ indexed: number; by_language: Record<string, number> }> {
    return this.call('post', '/knowledge/reindex', token, undefined, 120_000);
  }

  // ───── [Sprint 8.7] Agente de juegos (persona «game»): motor determinista primero, LLM solo para la jugada libre ─────
  gameTurn(
    input: {
      message: string;
      sessionId?: string | null;
      language: string;
      level?: string | null;
      game: unknown; // GameContext de FastAPI (lo arma NestJS Games en cada turno)
    },
    token: string,
  ): Promise<ChatResult> {
    return this.call(
      'post',
      '/chat',
      token,
      {
        message: input.message,
        session_id: input.sessionId ?? null,
        persona: 'game',
        language: input.language,
        level: input.level ?? null,
        game: input.game,
      },
      90_000,
    );
  }

  // ───── [Sprint 9.6] Avatar de conversación (persona «dialogue»): apertura determinista por tema, LLM dentro del tema y del nivel ─────
  dialogueTurn(
    input: {
      message: string;
      sessionId?: string | null;
      language: string;
      level: string;
      dialogue: unknown; // DialogueContext de FastAPI (lo arma NestJS Dialogues en cada turno)
    },
    token: string,
  ): Promise<ChatResult> {
    return this.call(
      'post',
      '/chat',
      token,
      {
        message: input.message,
        session_id: input.sessionId ?? null,
        persona: 'dialogue',
        language: input.language,
        level: input.level,
        dialogue: input.dialogue,
      },
      90_000,
    );
  }

  // ───── [Sprint 7.10] Agente Guía (persona «guide»): FAQ → manual → LLM con citas ─────
  private guideBody(input: GuideInput) {
    return {
      message: input.message,
      session_id: input.sessionId ?? null,
      persona: input.mode ?? 'guide',
      route: input.route ?? null,
      locale: input.locale,
      ...(input.mode === 'tutor' ? { language: input.language ?? 'en', level: input.level ?? 'A2' } : {}),
    };
  }

  guide(input: GuideInput, token: string): Promise<ChatResult> {
    return this.call('post', '/chat', token, this.guideBody(input), 90_000);
  }

  // [guideStream]: mismo SSE que el tutor + evento `sources` antes de `done`
  async guideStream(
    input: GuideInput,
    token: string,
    signal: AbortSignal,
  ): Promise<Readable> {
    try {
      const res = await firstValueFrom(
        this.http.post<Readable>(
          `${this.baseUrl}/chat/stream`,
          this.guideBody(input),
          {
            responseType: 'stream',
            timeout: 90_000,
            signal,
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      );
      return res.data;
    } catch (err) {
      this.logger.warn(
        `Assistant guide stream failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'El Agente Guía no está disponible en este momento',
      );
    }
  }

  conversation(sessionId: string, token: string): Promise<Conversation> {
    return this.call(
      'get',
      `/conversation/${encodeURIComponent(sessionId)}`,
      token,
    );
  }

  deleteConversation(sessionId: string, token: string): Promise<void> {
    return this.call(
      'delete',
      `/conversation/${encodeURIComponent(sessionId)}`,
      token,
    );
  }

  // [Índices del Agente Guía]: los alimenta Help (ADMIN) — FAQ publicadas y artículos del manual completos
  embedFaqs(faqs: unknown[], token: string): Promise<{ indexed: number }> {
    return this.call('post', '/knowledge/faq/embed', token, faqs, 120_000);
  }

  reindexManual(
    articles: unknown[],
    token: string,
  ): Promise<{ articles: number; sections: number }> {
    return this.call(
      'post',
      '/knowledge/manual/reindex',
      token,
      articles,
      120_000,
    );
  }
}
