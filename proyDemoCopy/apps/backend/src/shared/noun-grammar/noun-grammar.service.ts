import { HttpModule, HttpService } from '@nestjs/axios';
import { Global, Inject, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import jwtConfig from '../config/jwt.config';
import type { NounGrammarResult } from '../domain/interfaces/language-tools.interface';
// [NounGrammarService · 2026-11-06 · Regla obligatoria de vocabulario]: gramática de VARIOS términos en una sola llamada a FastAPI (/noun-grammar/batch)
// La usan los generadores con IA (vocabulario del currículo, juegos, políglota) → cada sustantivo sale con artículo/género/plural/clasificador AL GENERAR (antes solo el prompt lo pedía y el modelo pequeño lo ignoraba)
// [Patrón]: Adapter + Fail Soft (IA caída o lenta → null por término: el borrador se entrega igual y el listener lo repara al aprobar) | [Principio]: SRP + DRY

const NOUN_LANGUAGES = new Set(['de', 'fr', 'pt', 'es', 'en', 'ru', 'zh']);
const TIMEOUT_MS = 100_000; // < plazos de los borradores (240–270 s) y del BFF (300 s)
const MAX_TERMS = 40; // = NounGrammarBatchRequest.terms
const CHUNK = 4; // Términos por llamada (~50 s en CPU con el prompt corto)
const BUDGET_MS = 170_000; // Tope total: < plazos de los borradores (240–270 s) y del BFF (300 s)

@Injectable()
export class NounGrammarService {
  private readonly logger = new Logger(NounGrammarService.name);
  private readonly url = `${(process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')}/api/v1/language-tools/noun-grammar/batch`;

  constructor(
    private readonly http: HttpService,
    private readonly jwt: JwtService,
    @Inject(jwtConfig.KEY) private readonly cfg: ConfigType<typeof jwtConfig>,
  ) {}

  // [many]: un resultado (o null) por término, en el mismo orden | nunca lanza
  // [Fix 2026-11-11]: en CPU el LLM tarda ~12 s por término → un lote de 8+ superaba TIMEOUT_MS y TODO el mazo salía sin artículo.
  // Ahora en tandas de CHUNK (cada una con su plazo) hasta agotar BUDGET_MS: una tanda lenta solo deja sin artículo SUS términos
  async many(terms: readonly string[], language: string, actorId = 'system'): Promise<(NounGrammarResult | null)[]> {
    const list = terms.map((t) => t.trim()).slice(0, MAX_TERMS);
    const out: (NounGrammarResult | null)[] = terms.map(() => null);
    if (!list.length || !NOUN_LANGUAGES.has(language)) return out;
    const token = await this.jwt.signAsync({ sub: actorId, role: 'TEACHER', svc: 'noun-grammar' }, { secret: this.cfg.accessSecret, expiresIn: 600 }).catch(() => null);
    if (!token) return out;
    const deadline = Date.now() + BUDGET_MS;
    for (let i = 0; i < list.length && Date.now() < deadline; i += CHUNK) {
      const part = list.slice(i, i + CHUNK);
      try {
        const res = await firstValueFrom(
          this.http.post<NounGrammarResult[]>(this.url, { terms: part.map((t) => t || '-'), language }, { timeout: Math.min(TIMEOUT_MS, Math.max(deadline - Date.now(), 1)), headers: { Authorization: `Bearer ${token}` } }),
        );
        (Array.isArray(res.data) ? res.data : []).forEach((r, k) => (out[i + k] = r ?? null));
      } catch (err) {
        this.logger.warn(`Gramática de ${part.length} términos (${language}) no disponible: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return out;
  }
}

// `@Global`: un solo proveedor para Curriculum, Games y Polyglot sin importar módulos entre sí (Vocabulary ya importa Curriculum → evita el ciclo)
@Global()
@Module({
  imports: [HttpModule, JwtModule.register({}), ConfigModule.forFeature(jwtConfig)],
  providers: [NounGrammarService],
  exports: [NounGrammarService],
})
export class NounGrammarModule {}
