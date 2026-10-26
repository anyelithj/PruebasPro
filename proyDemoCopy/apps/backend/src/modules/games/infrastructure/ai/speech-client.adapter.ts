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
  FluencyResult,
  SpeechPort,
  WordStamp,
} from '../../domain/interfaces/game-agent.interface';
// [Adapter SpeechClient · Sprints 8.5/8.6]: HTTP hacia FastAPI /speech/transcribe (multipart) y /speech/fluency para las rondas orales | [Patrón]: Adapter (implementa SpeechPort) | [Principio]: DIP + SRP | [Tecnología]: @nestjs/axios + FormData/Blob nativos de Node 22
// [Privacidad]: el audio pasa en memoria y no se guarda ni aquí ni en FastAPI

// [SpeechFailureCode · 2026-10-25]: por qué no hay voz a texto → el frontend elige el respaldo (dictado del navegador o escribir) | `as const` + tipo derivado (TS): unión literal sin enum
export const SPEECH_FAILURE = {
  engineMissing: 'SPEECH_ENGINE_MISSING', // FastAPI vive pero no tiene faster-whisper (lo arregla el admin con pip)
  serviceDown: 'SPEECH_SERVICE_DOWN', // FastAPI no responde (apagado, timeout, red)
  inference: 'SPEECH_INFERENCE_ERROR', // El modelo falló con esta grabación (se puede reintentar)
} as const;
export type SpeechFailureCode =
  (typeof SPEECH_FAILURE)[keyof typeof SPEECH_FAILURE];

// [Mensajes para el alumno]: accionables y sin detalles técnicos | `Record<Union, string>` (TS): el compilador exige un texto por código
const FAILURE_MESSAGES: Record<SpeechFailureCode, string> = {
  SPEECH_ENGINE_MISSING:
    'El reconocimiento de voz del servidor no está instalado. Escribe tu respuesta o usa el dictado del navegador (Chrome/Edge).',
  SPEECH_SERVICE_DOWN:
    'El servicio de reconocimiento de voz no responde. Escribe tu respuesta o inténtalo más tarde.',
  SPEECH_INFERENCE_ERROR:
    'No se pudo transcribir la grabación. Inténtalo otra vez o escribe tu respuesta.',
};

export interface SpeechFailure {
  code: SpeechFailureCode | 'BAD_AUDIO';
  status?: number; // Status de FastAPI (undefined = sin respuesta)
  detail: string; // Causa técnica (log y entornos no productivos)
}

// [classifySpeechFailure]: error de axios → causa tipada | [Paradigma]: Funcional (pura, testeable sin HTTP) | [Principio]: SRP
export function classifySpeechFailure(err: unknown): SpeechFailure {
  if (!isAxiosError(err) || !err.response)
    return {
      code: SPEECH_FAILURE.serviceDown,
      detail: err instanceof Error ? err.message : String(err),
    };
  const { status } = err.response;
  // Envelope de FastAPI: { detail, code, status_code, ... } (src/shared/exceptions/handlers.py)
  const body = (err.response.data ?? {}) as {
    detail?: unknown;
    code?: unknown;
  };
  const detail = Array.isArray(body.detail)
    ? body.detail.join(', ')
    : String(body.detail ?? err.message);
  if (status === 400 || status === 422)
    return { code: 'BAD_AUDIO', status, detail };
  if (body.code === SPEECH_FAILURE.engineMissing)
    return { code: SPEECH_FAILURE.engineMissing, status, detail };
  return { code: SPEECH_FAILURE.inference, status, detail };
}

@Injectable()
export class SpeechClient implements SpeechPort {
  private readonly logger = new Logger(SpeechClient.name);
  private readonly baseUrl = `${(process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')}/api/v1/speech`;
  private readonly warned = new Set<string>(); // [WARN una vez]: códigos ya avisados → no se repite el mismo aviso en cada grabación
  private readonly exposeReason = process.env.NODE_ENV !== 'production'; // [Seguridad]: la causa técnica solo fuera de producción

  constructor(private readonly http: HttpService) {}

  private async post<T>(
    path: string,
    body: unknown,
    token: string,
    timeout: number,
  ): Promise<T> {
    try {
      const res = await firstValueFrom(
        this.http.post<T>(`${this.baseUrl}${path}`, body, {
          timeout,
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      this.warned.clear(); // Volvió a funcionar → si cae otra vez se vuelve a avisar
      return res.data;
    } catch (err) {
      const failure = classifySpeechFailure(err);
      const { code } = failure; // Variable local → TS estrecha el tipo tras el `if` (BAD_AUDIO queda fuera)
      if (code === 'BAD_AUDIO')
        throw new BadRequestException('Audio no válido o demasiado largo');
      this.report(path, code, failure);
      // [503 con motivo]: `message` legible + `code` estable (+ `reason` técnico fuera de producción); el filtro global lo copia al cuerpo
      throw new ServiceUnavailableException({
        message: FAILURE_MESSAGES[code],
        code,
        ...(this.exposeReason && { reason: failure.detail }),
      });
    }
  }

  // [report]: indisponibilidad esperable → WARN la primera vez por código y DEBUG después (sin stack traces) | [Principio]: logs con señal, no ruido
  private report(
    path: string,
    code: SpeechFailureCode,
    f: SpeechFailure,
  ): void {
    const line = `Speech ${path} no disponible [${code}] (${f.status ?? 'sin respuesta'}): ${f.detail}`;
    if (this.warned.has(code)) return this.logger.debug(line);
    this.warned.add(code);
    this.logger.warn(line);
  }

  transcribe(
    audio: Buffer,
    mime: string,
    language: string | undefined,
    token: string,
  ) {
    const form = new FormData(); // `FormData` + `Blob` (Web API en Node 22): multipart sin librerías
    form.append(
      'file',
      new Blob([new Uint8Array(audio)], { type: mime || 'audio/webm' }),
      'audio',
    );
    if (language) form.append('language', language);
    return this.post<{
      text: string;
      language: string;
      duration: number;
      words: WordStamp[];
      model: string;
    }>(
      '/transcribe',
      form,
      token,
      600_000, // [2026-10-23]: canciones/videos de varios minutos en CPU (antes 120 s: solo grabaciones cortas)
    );
  }

  fluency(
    input: {
      words: WordStamp[];
      prompt_end_s: number;
      target_vocabulary: string[];
    },
    token: string,
  ) {
    return this.post<FluencyResult>('/fluency', input, token, 15_000);
  }
}
