import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { LevelEstimate } from '../../domain/entities/dialogue.entity';
import type { LevelClassifierPort } from '../../domain/interfaces/level-classifier.interface';
// [Adapter LevelClassifierClient · Sprint 9.3]: HTTP hacia FastAPI /level-classifier/classify con el JWT del usuario | [Patrón]: Adapter (implementa LevelClassifierPort) | [Principio]: DIP + SRP | [Tecnología]: @nestjs/axios + RxJS

@Injectable()
export class LevelClassifierClient implements LevelClassifierPort {
  private readonly logger = new Logger(LevelClassifierClient.name);
  private readonly url = `${(process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')}/api/v1/level-classifier/classify`;

  constructor(private readonly http: HttpService) {}

  async classify(
    input: { language: string; turns: string[] },
    token: string,
  ): Promise<LevelEstimate> {
    try {
      const res = await firstValueFrom(
        this.http.post<LevelEstimate>(this.url, input, {
          timeout: 120_000, // Caso dudoso → rúbrica con el LLM local
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      const { level, confidence, method, indicators, explanation, model } =
        res.data;
      return {
        level,
        confidence,
        method,
        indicators,
        explanation,
        model: model ?? null,
      };
    } catch (err) {
      this.logger.warn(
        `LevelClassifier falló (${isAxiosError(err) ? (err.response?.status ?? 'sin respuesta') : 'error'})`,
      );
      throw new ServiceUnavailableException(
        'La estimación de nivel no está disponible',
      );
    }
  }
}
