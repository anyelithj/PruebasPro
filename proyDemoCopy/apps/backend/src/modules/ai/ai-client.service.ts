import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { Language } from '../quiz/domain/value-objects/language.vo';
// [AIClientService]: cliente HTTP a FastAPI ai-service | [Patron]: Adapter + Facade | [Principio]: DIP | [Paradigma]: POO

export interface GradeAnswerInput {
  questionId: string;
  questionType: 'multiple_choice' | 'true_false' | 'open_answer';
  questionText: string;
  correctAnswer: string;
  userAnswer: string;
  // [ISO 639-1]: idioma del contenido evaluado (grade) o de instrucción (feedback)
  language?: Language;
  similarityThreshold?: number;
}

export interface GradeAnswerResult {
  question_id: string;
  user_id: string;
  score: number;
  is_correct: boolean;
  confidence: number;
  feedback: string | null;
  strategy_used: string;
}

// [Input feedback]: SSOT alineado con FastAPI GenerateFeedbackRequest | [Principio]: SSOT
export interface GenerateFeedbackInput {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  userAnswer: string;
  topic?: string;
  // [ISO 639-1]: idioma del contenido evaluado (grade) o de instrucción (feedback)
  language?: Language;
}

export interface FeedbackResult {
  question_id: string;
  feedback_type: string;
  message: string;
  suggestion: string | null;
  references: string[];
}

// [Input weakness analysis]: SSOT alineado con FastAPI WeaknessAnalysisRequest
export interface WeaknessAnalysisInput {
  userId: string;
  topicAccuracy: Record<string, number>;
  threshold?: number;
}

export interface WeakTopic {
  topic: string;
  accuracy: number;
  recommendation: string;
}

export interface WeaknessAnalysisResult {
  user_id: string;
  weak_topics: WeakTopic[];
  strong_topics: string[];
}

// [Plan de estudio · Sprint 5.2]: respuesta de POST /api/v1/feedback/study-plan (FastAPI, determinista)
export interface StudyPlanResult {
  user_id: string;
  plan: Array<{
    order: number;
    topic: string;
    activity: string;
    estimated_minutes: number;
  }>;
  total_minutes: number;
}

// [Voz local · Sprint 4.7]: entrada y salida de POST /api/v1/language-tools/speak
export interface SpeakInput {
  text: string;
  language: string; // Código ISO 639-1 (en, fr, …)
  variant: string; // BCP-47 (en-GB, pt-BR, …)
}
export interface SpeakResult {
  audio: Buffer; // WAV
  voice: string; // Voz de espeak-ng usada (cabecera X-Voice)
  variant: string;
  engine: string;
}

@Injectable()
export class AIClientService {
  private readonly logger = new Logger(AIClientService.name);
  private readonly baseUrl: string;

  constructor(private readonly http: HttpService) {
    // [Lee env]: AI_SERVICE_URL fallback localhost:8000
    this.baseUrl = (
      process.env.AI_SERVICE_URL ?? 'http://localhost:8000'
    ).replace(/\/$/, '');
  }

  // [grade]: invoca POST /api/v1/grading/grade con bearer del user actual | [Patron]: Adapter
  async grade(
    input: GradeAnswerInput,
    accessToken: string,
  ): Promise<GradeAnswerResult> {
    const url = `${this.baseUrl}/api/v1/grading/grade`;
    const payload = {
      question_id: input.questionId,
      question_type: input.questionType,
      question_text: input.questionText,
      correct_answer: input.correctAnswer,
      user_answer: input.userAnswer,
      language: input.language ?? 'es',
      similarity_threshold: input.similarityThreshold ?? 0.75,
    };
    try {
      const res = await firstValueFrom(
        this.http.post<GradeAnswerResult>(url, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15_000,
        }),
      );
      return res.data;
    } catch (err) {
      this.logger.warn(
        `AI grading failed, falling back to local exact-match: ${err instanceof Error ? err.message : String(err)}`,
      );
      // [Fallback local]: si FastAPI no responde, no rompemos el flujo del quiz
      const isCorrect =
        input.userAnswer.trim().toLowerCase() ===
        input.correctAnswer.trim().toLowerCase();
      return {
        question_id: input.questionId,
        user_id: '',
        score: isCorrect ? 1 : 0,
        is_correct: isCorrect,
        confidence: isCorrect ? 1 : 0,
        feedback: null,
        strategy_used: 'exact_match_fallback_nestjs',
      };
    }
  }

  // [generateFeedback]: invoca POST /api/v1/feedback/generate para retroalimentación pedagógica | [Patrón]: Adapter | [Principio]: SRP
  async generateFeedback(
    input: GenerateFeedbackInput,
    accessToken: string,
  ): Promise<FeedbackResult | null> {
    const url = `${this.baseUrl}/api/v1/feedback/generate`;
    const payload = {
      question_id: input.questionId,
      question_text: input.questionText,
      correct_answer: input.correctAnswer,
      user_answer: input.userAnswer,
      topic: input.topic,
      language: input.language ?? 'es',
    };
    try {
      const res = await firstValueFrom(
        this.http.post<FeedbackResult>(url, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 30_000,
        }),
      );
      return res.data;
    } catch (err) {
      this.logger.warn(
        `AI feedback failed (returning null, UI fallback): ${err instanceof Error ? err.message : String(err)}`,
      );
      // [Null en error]: la UI muestra mensaje genérico, no rompe la sesión | [Patrón]: Null Object soft
      return null;
    }
  }

  // [analyzeWeaknesses]: invoca POST /api/v1/feedback/weaknesses para identificar temas débiles | [Patrón]: Adapter
  async analyzeWeaknesses(
    input: WeaknessAnalysisInput,
    accessToken: string,
  ): Promise<WeaknessAnalysisResult | null> {
    const url = `${this.baseUrl}/api/v1/feedback/weaknesses`;
    const payload = {
      user_id: input.userId,
      topic_accuracy: input.topicAccuracy,
      threshold: input.threshold ?? 0.6,
    };
    try {
      const res = await firstValueFrom(
        this.http.post<WeaknessAnalysisResult>(url, payload, {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15_000,
        }),
      );
      return res.data;
    } catch (err) {
      this.logger.warn(
        `AI weakness analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  // [studyPlan · Sprint 5.2]: plan ordenado a partir del análisis de debilidades | null si FastAPI no responde (la UI muestra solo las debilidades) | [Patrón]: Adapter
  async studyPlan(
    weakness: WeaknessAnalysisResult,
    accessToken: string,
  ): Promise<StudyPlanResult | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<StudyPlanResult>(
          `${this.baseUrl}/api/v1/feedback/study-plan`,
          weakness,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            timeout: 15_000,
          },
        ),
      );
      return res.data;
    } catch (err) {
      this.logger.warn(
        `AI study plan failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  // [speak]: audio WAV desde FastAPI (espeak-ng) | `responseType: 'arraybuffer'` (axios): binario sin convertir a texto | [Patrón]: Adapter
  // Sin fallback local: si no hay motor de voz se responde 503 (no se inventa audio)
  async speak(input: SpeakInput, accessToken: string): Promise<SpeakResult> {
    try {
      const res = await firstValueFrom(
        this.http.post<ArrayBuffer>(
          `${this.baseUrl}/api/v1/language-tools/speak`,
          input,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            responseType: 'arraybuffer',
            timeout: 15_000,
          },
        ),
      );
      const header = (name: string): string => String(res.headers[name] ?? ''); // Cabeceras en minúsculas (axios)
      return {
        audio: Buffer.from(res.data),
        voice: header('x-voice'),
        variant: header('x-variant') || input.variant,
        engine: header('x-engine'),
      };
    } catch (err) {
      // `isAxiosError` (axios): distingue respuesta HTTP de error de red
      if (isAxiosError(err) && err.response?.status === 422) {
        throw new BadRequestException(
          `Variante de voz no soportada: ${input.language} ${input.variant}`,
        );
      }
      this.logger.warn(
        `Speech synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException(
        'El motor de voz no está disponible en este momento',
      );
    }
  }
}
