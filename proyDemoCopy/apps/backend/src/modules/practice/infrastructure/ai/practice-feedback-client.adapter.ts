import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import type {
  EvaluateInput,
  EvaluateResult,
  PracticeEvaluatorPort,
} from '../../domain/interfaces/practice-evaluator.interface';
// [Adapter PracticeFeedbackClient · Sprint 8.12]: HTTP hacia FastAPI /api/v1/grading/practice con el JWT del usuario | [Patrón]: Adapter (implementa PracticeEvaluatorPort) | [Principio]: DIP + SRP | [Tecnología]: @nestjs/axios

@Injectable()
export class PracticeFeedbackClient implements PracticeEvaluatorPort {
  private readonly logger = new Logger(PracticeFeedbackClient.name);
  private readonly url = `${(process.env.AI_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, '')}/api/v1/grading/practice`;

  constructor(private readonly http: HttpService) {}

  async evaluate(input: EvaluateInput, token: string): Promise<EvaluateResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<EvaluateResult>(this.url, input, {
          timeout: 60_000, // Respuesta abierta: puede pedir explicación al LLM local
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
      return res.data;
    } catch (err) {
      this.logger.warn(
        `Grading /practice falló: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'La corrección automática no está disponible en este momento',
      );
    }
  }
}
