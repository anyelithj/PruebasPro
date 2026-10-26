import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { isSse } from '../utils/is-sse.util';
// [Interceptor de timeout]: aborta requests que exceden N ms | [Patrón]: Interceptor | [Principio]: SRP | [Paradigma]: AOP + Reactivo

// [Default 30s]: cubre operaciones lentas pero evita conexiones colgadas
const DEFAULT_TIMEOUT_MS = 30_000;
// [Timeout extendido para rutas IA]: traducción Ollama puede tardar 60-90s en cold start | [Patrón]: Per-Route Policy
const AI_LONG_TIMEOUT_MS = 600_000;
export const LONG_TIMEOUT_PATTERNS: RegExp[] = [
  /\/quiz$/i,
  // [2026-10-25]: TODO borrador o enriquecimiento con el LLM local (letra de canción, poliglota, gramática…) → antes caían en 30 s y respondían 408
  /\/(draft|enrich)(\/|\?|$)/,
  /\/polyglot\/(concepts\/[^/]+\/terms|topics\/[^/]+\/ipa)/, // IPA de cada término con el LLM local
  /\/music\/lyrics\//, // Letra desde enlace (descarga + limpieza) y borrador con IA
  /\/ai\/feedback\//,
  // [/quiz/ai/generate]: Qwen3:8b / Mistral Nemo en CPU pueden tardar 60-120s en cold start | [Patrón]: Per-Route Policy
  /\/quiz\/ai\/generate$/,
  // [/curriculum/ai/content y /topics]: generación de recursos en lotes con el modelo local (1-2 min por lote de 10) | Regex (JS): cualquier subruta de /curriculum/ai/
  /\/curriculum\/ai\//,
  // [/ai/assistant/* y /ai/own-llm/*]: el tutor RAG y el corrector esperan hasta 90 s al LLM local (antes los cortaba el límite de 30 s)
  /\/ai\/(assistant|own-llm)\//,
  // [Sprint 9.2/9.3]: traducción e IPA de una letra entera, alineación del audio con faster-whisper y turnos del avatar con el LLM local
  /\/music\/songs\/[^/]+\/(lines|audio)/,
  /\/dialogues(\/[^/]+)?\/(turns|audio|sessions)/,
  /\/dialogues\/?$/,
  /\/dialogues\/draft$/, // [2026-10-19]: borrador de diálogo con el LLM local
  /\/courses\/draft$/, // [2026-10-23]: borrador de curso con el LLM local
  // [Sprint 7.10]: Agente Guía (LLM local) y reindexado del manual/FAQ (recodifica embeddings)
  /\/help\/(ask|manual\/reindex|faqs)/,
  // [Fase 8]: traducción/IPA con el LLM local, turno del agente de juegos, voz a texto (carga de faster-whisper), corrección de práctica y borradores con IA
  /\/vocabulary(\/lookup)?(\/word|\/topic|\/translate)?$/, // [2026-10-19]: + título de tema (traducción con el LLM local)
  /\/games\/(agent\/turn|sessions\/[^/]+\/rounds)$/,
  /\/speech\/(transcribe|fluency)$/,
  /\/practice\/(attempts|activities\/draft)$/,
  /\/reading\/texts(\/draft|\/[^/?]+(\/enrich|\/sentences\/[^/?]+)?)?(\?|$)/, // [2026-10-25 · Lectura]: borrador con el LLM local y traducción/IPA por lotes al crear o editar
];

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  // [intercept]: aplica operador timeout al stream | [Paradigma]: Reactivo
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (isSse(context)) return next.handle() as never; // [Sprint 6.2]: el flujo SSE es largo y ya trae su formato (MessageEvent)
    // [Selecciona timeout por path]: rutas IA requieren más tiempo | [Patrón]: Strategy
    const req = context
      .switchToHttp()
      .getRequest<{ url?: string; method?: string }>();
    const url = req?.url ?? '';
    const isLong = LONG_TIMEOUT_PATTERNS.some((re) => re.test(url));
    const ttl = isLong ? AI_LONG_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

    return next.handle().pipe(
      timeout(ttl),
      catchError((err) => {
        // [Mapeo a HTTP 408]: convierte timeout RxJS en excepción HTTP estándar
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err as Error);
      }),
    );
  }
}
