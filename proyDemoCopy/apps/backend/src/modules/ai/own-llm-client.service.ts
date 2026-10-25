import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
// [OwnLlmClient · Sprint 5.6 · RF-144]: único cliente hacia el LLM propio de FastAPI (/api/v1/own-llm/*) con el JWT propagado; el modelo vive completo en FastAPI | [Patrón]: Adapter + Gateway | [Principio]: SRP (otro servicio remoto, otros tiempos) + DIP | [Paradigma]: POO

// [Contrato]: espejo de los modelos Pydantic de FastAPI (snake_case tal como llegan) | [Principio]: SSOT en FastAPI
export interface ErrorFinding {
  type:
    | 'grammar'
    | 'vocabulary'
    | 'spelling'
    | 'punctuation'
    | 'word_order'
    | 'style';
  original: string;
  correction: string;
  explanation_es: string;
  start: number | null; // Índices [start, end) sobre el texto original (calculados en el servidor)
  end: number | null;
}
export interface WritingCorrection {
  findings: ErrorFinding[];
  corrected_text: string;
  explanation_es: string;
  model_used: string;
  fallback_used: boolean; // true → respondió el modelo base porque el propio no estaba o falló
  latency_ms: number;
  flags: string[]; // REQUIERE_REVISION: el contenido de IA nunca se presenta como verificado
}
export interface WritingScope {
  languages: string[];
  levels: string[];
  max_text_length: number;
}
export interface WritingCorrectionInput {
  text: string;
  language: string;
  level: string;
}

@Injectable()
export class OwnLlmClientService {
  private readonly logger = new Logger(OwnLlmClientService.name);
  private readonly baseUrl = `${(process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')}/api/v1/own-llm`;

  constructor(private readonly http: HttpService) {}

  // `private async` (TS): única puerta HTTP del cliente → mismo manejo de errores en todas las rutas | [Principio]: DRY
  private async call<T>(
    method: 'get' | 'post',
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
        `Own LLM ${path} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      // Sin corrección inventada: ni el modelo propio ni el base respondieron → 503 y la UI lo explica
      throw new ServiceUnavailableException(
        'El corrector de redacciones no está disponible en este momento',
      );
    }
  }

  // [correct]: 150 s → FastAPI espera hasta 120 s por modelo (carga en CPU la primera vez)
  correct(
    input: WritingCorrectionInput,
    token: string,
  ): Promise<WritingCorrection> {
    return this.call('post', '/correct', token, input, 150_000);
  }

  scope(token: string): Promise<WritingScope> {
    return this.call('get', '/scope', token);
  }
}
