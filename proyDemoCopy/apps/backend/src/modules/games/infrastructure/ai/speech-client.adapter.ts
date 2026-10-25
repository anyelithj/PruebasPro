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

@Injectable()
export class SpeechClient implements SpeechPort {
  private readonly logger = new Logger(SpeechClient.name);
  private readonly baseUrl = `${(process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')}/api/v1/speech`;

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
      return res.data;
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      this.logger.warn(`Speech ${path} falló (${status ?? 'sin respuesta'})`);
      if (status === 422 || status === 400)
        throw new BadRequestException('Audio no válido o demasiado largo');
      throw new ServiceUnavailableException(
        'El reconocimiento de voz no está disponible',
      );
    }
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
