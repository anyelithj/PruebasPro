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
  AlignmentPort,
  AlignmentResult,
} from '../../../../shared/domain/interfaces/alignment.interface';
// [Adapter AlignmentClient · Sprints 9.2/9.4]: HTTP hacia FastAPI /alignment/align (multipart) con el JWT del usuario; lo usan SyncSongLinesUseCase (propuesta de tiempos) y Dialogues (exportado) | [Patrón]: Adapter (implementa AlignmentPort) | [Principio]: DIP + SRP + DRY | [Tecnología]: @nestjs/axios + FormData/Blob nativos de Node 22
// [Privacidad]: el audio viaja en memoria y FastAPI no lo guarda

@Injectable()
export class AlignmentClient implements AlignmentPort {
  private readonly logger = new Logger(AlignmentClient.name);
  private readonly url = `${(process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')}/api/v1/alignment/align`;

  constructor(private readonly http: HttpService) {}

  async align(
    input: {
      audio: Buffer;
      mime: string;
      lines: string[];
      language: string;
      kind: 'dialogue' | 'song';
    },
    token: string,
  ): Promise<AlignmentResult> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(input.audio)], { type: input.mime }),
      'audio',
    );
    form.append('lines', JSON.stringify(input.lines));
    form.append('language', input.language);
    form.append('kind', input.kind);
    try {
      const res = await firstValueFrom(
        this.http.post<AlignmentResult>(this.url, form, {
          timeout: 300_000, // Canción completa en CPU: la transcripción tarda más que la duración del audio
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return res.data;
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      this.logger.warn(`Alignment falló (${status ?? 'sin respuesta'})`);
      if (status === 422 || status === 400)
        throw new BadRequestException(
          'Audio o líneas no válidos para sincronizar',
        );
      throw new ServiceUnavailableException(
        'La sincronización automática no está disponible; marca los tiempos a mano',
      );
    }
  }
}
