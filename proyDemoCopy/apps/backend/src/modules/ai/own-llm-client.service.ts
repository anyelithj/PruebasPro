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
    | 'capitalization' // [2026-10-28]: Mayúsculas («ana» → «Ana»), separada de puntuación como en GrammarMama
    | 'punctuation'
    | 'word_order'
    | 'style'
    | 'article' // [2026-11-02]: Artículo («teacher» → «a teacher»)
    | 'transcription'; // [2026-11-13 · Anexo A]: posible error del reconocimiento de voz
  original: string;
  correction: string;
  explanation_es: string; // [2026-10-28]: SIEMPRE en español (FastAPI sustituye la del LLM si llega en otro idioma)
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
  language?: string; // [2026-10-27]: idioma con el que se corrigió (el detectado si se pidió 'auto')
  detected_language?: string | null; // [2026-10-27]: solo cuando language='auto'
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
  context?: string; // [2026-11-11]: pregunta a la que responde el alumno
}

// ───── [Corrector pedagógico ÚNICO · Anexo A · 2026-11-13]: espejo de corrector_io.py (FastAPI es la fuente de verdad) ─────
export type TextKind = 'frase' | 'titulo' | 'expresion';
export type SpeechOrigin = 'voz' | 'escrito';
export type Verdict = 'correcta' | 'con_errores' | 'no_responde';
export interface CorrectorInput {
  pregunta_previa?: string; // Pregunta del avatar o del ejercicio
  texto: string;
  idioma: string; // en | es | fr | de | pt | zh | ru
  nivel: string; // A1–C2
  tema?: string;
  tipo_de_texto?: TextKind;
  origen?: SpeechOrigin;
}
export interface SentenceCorrection {
  frase_corregida: string;
  veredicto: Verdict;
  errores: {
    categoria: string;
    original: string;
    sugerencia: string;
    explicacion: string;
  }[];
  traduccion: string;
  alternativas_traduccion: {
    tipo: 'literal' | 'natural' | 'cercana';
    texto: string;
  }[];
  comentario: string;
}
// [Respuesta]: la corrección + puntuación (100 solo si «correcta») + trazabilidad (modelo, versión del prompt, latencia · RNF-35)
export interface CorrectorResult {
  correccion: SentenceCorrection;
  puntuacion: number;
  modelo: string;
  respaldo: boolean;
  version_prompt: string;
  latencia_ms: number;
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

  // [correctSentence · Anexo A]: el MISMO JSON alimenta el feedback previo, la puntuación y la respuesta del avatar | 150 s: carga en frío en CPU
  correctSentence(
    input: CorrectorInput,
    token: string,
  ): Promise<CorrectorResult> {
    return this.call('post', '/corrector', token, input, 150_000);
  }

  scope(token: string): Promise<WritingScope> {
    return this.call('get', '/scope', token);
  }
}
