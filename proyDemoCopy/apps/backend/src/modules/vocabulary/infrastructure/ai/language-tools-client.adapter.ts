import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type {
  IpaOnlyResult,
  LanguageToolsPort,
  LinesResult,
  TermLookupResult,
  WordLookupResult,
} from '../../../../shared/domain/interfaces/language-tools.interface';
// [Adapter LanguageToolsClient · Sprint 8.2]: HTTP hacia FastAPI /api/v1/language-tools/{lookup,word} con el JWT del usuario | [Patrón]: Adapter (implementa LanguageToolsPort) | [Principio]: DIP + SRP (única puerta HTTP del módulo) | [Tecnología]: @nestjs/axios + RxJS

@Injectable()
export class LanguageToolsClient implements LanguageToolsPort {
  private readonly logger = new Logger(LanguageToolsClient.name);
  private readonly baseUrl = `${(process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')}/api/v1/language-tools`;

  constructor(private readonly http: HttpService) {}

  // `private async` (TS): un solo punto de errores → 400 si FastAPI rechaza el idioma, 503 si no responde | [Principio]: DRY
  private async post<T>(
    path: string,
    body: unknown,
    token: string,
  ): Promise<T> {
    try {
      const res = await firstValueFrom(
        this.http.post<T>(`${this.baseUrl}${path}`, body, {
          timeout: 90_000, // El LLM local en CPU puede tardar la primera vez
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return res.data;
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      this.logger.warn(
        `LanguageTools ${path} falló (${status ?? 'sin respuesta'})`,
      );
      if (status === 422 || status === 400)
        throw new BadRequestException('Idioma o texto no admitidos');
      throw new ServiceUnavailableException(
        'El servicio de traducción e IPA no está disponible',
      );
    }
  }

  lookup(
    text: string,
    language: string,
    token: string,
  ): Promise<TermLookupResult> {
    return this.post(
      '/lookup',
      { text, source: language, target: 'es' },
      token,
    );
  }

  word(
    word: string,
    sentence: string,
    language: string,
    token: string,
  ): Promise<WordLookupResult> {
    return this.post(
      '/word',
      { word, sentence, language, target: 'es' },
      token,
    );
  }

  // [translate · 2026-10-19]: traducción entre dos idiomas cualesquiera (p. ej. el tema «La familia» → «The family»)
  translate(
    text: string,
    source: string,
    target: string,
    token: string,
  ): Promise<{ translation: string }> {
    return this.post('/translate', { text, source, target }, token);
  }

  // [Sprint 10.5]: /ipa devuelve { results: { uk, us } } en inglés y { results: { default } } en el resto → se aplana
  async ipa(
    text: string,
    language: string,
    token: string,
  ): Promise<IpaOnlyResult> {
    const res = await this.post<{
      results: Record<string, { full: string }>;
      engine: string;
    }>('/ipa', { text, language }, token);
    const r = res.results;
    return {
      ipa: (r.uk ?? r.default ?? Object.values(r)[0])?.full ?? '',
      ipa_us: r.us?.full ?? null,
      engine: res.engine,
    };
  }

  // [Sprint 9.1]: lotes de 80 líneas (límite de FastAPI) en secuencia → una letra larga no satura el LLM local
  async lines(
    lines: string[],
    language: string,
    token: string,
  ): Promise<LinesResult> {
    const out: LinesResult = {
      lines: [],
      engine: '',
      needs_native_review: false,
    };
    for (let i = 0; i < lines.length; i += 80) {
      const part = await this.post<LinesResult>(
        '/lines',
        { lines: lines.slice(i, i + 80), language },
        token,
      );
      out.lines.push(...part.lines.map((l) => ({ ...l, index: l.index + i })));
      out.engine = part.engine;
      out.needs_native_review = part.needs_native_review;
    }
    return out;
  }
}
