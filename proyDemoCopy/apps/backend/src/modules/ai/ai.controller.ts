import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import type { JwtPayload } from '../../shared/decorators/current-user.decorator';
import type { Language } from '../quiz/domain/value-objects/language.vo';
import {
  AIClientService,
  type FeedbackResult,
  type StudyPlanResult,
  type WeaknessAnalysisResult,
} from './ai-client.service';
// [AIController]: proxy NestJS → FastAPI para feedback/weaknesses | [Patrón]: Facade + Proxy | [Principio]: SRP | [Paradigma]: POO

// [DTO body weaknesses]: SSOT alineado con FastAPI WeaknessAnalysisRequest | [Principio]: SSOT
export interface AnalyzeWeaknessesBody {
  topicAccuracy: Record<string, number>;
  threshold?: number;
}

// [DTO body feedback]: feedback ad-hoc desde frontend (sin pasar por submit-answer) | [Principio]: ISP
export interface GenerateFeedbackBody {
  questionId: string;
  questionText: string;
  correctAnswer: string;
  userAnswer: string;
  topic?: string;
  // [ISO 639-1]: idioma del contenido evaluado (grade) o de instrucción (feedback)
  language?: Language;
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai/feedback')
export class AIController {
  constructor(private readonly ai: AIClientService) {}

  // [POST /ai/feedback/weaknesses]: identifica temas débiles del usuario | [Patrón]: Proxy
  @Post('weaknesses')
  @ApiOperation({
    summary: 'Analyze weak topics for current user (proxies to FastAPI)',
  })
  async weaknesses(
    @Body() body: AnalyzeWeaknessesBody,
    @CurrentUser() user: JwtPayload,
    @Headers('authorization') auth: string,
  ): Promise<WeaknessAnalysisResult | null> {
    const token = (auth ?? '').replace(/^Bearer\s+/i, '');
    return this.ai.analyzeWeaknesses(
      {
        userId: user.sub,
        topicAccuracy: body.topicAccuracy ?? {},
        threshold: body.threshold,
      },
      token,
    );
  }

  // [POST /ai/feedback/study-plan · Sprint 5.2]: debilidades + plan en una llamada | [Patrón]: Facade (orquesta dos servicios de FastAPI)
  @Post('study-plan')
  @ApiOperation({
    summary:
      'Weak topics + ordered study plan for current user (proxies to FastAPI)',
  })
  async studyPlan(
    @Body() body: AnalyzeWeaknessesBody,
    @CurrentUser() user: JwtPayload,
    @Headers('authorization') auth: string,
  ): Promise<{
    weaknesses: WeaknessAnalysisResult;
    plan: StudyPlanResult | null;
  } | null> {
    const token = (auth ?? '').replace(/^Bearer\s+/i, '');
    const weaknesses = await this.ai.analyzeWeaknesses(
      {
        userId: user.sub,
        topicAccuracy: body.topicAccuracy ?? {},
        threshold: body.threshold,
      },
      token,
    );
    if (!weaknesses) return null; // FastAPI no disponible → la UI lo informa sin romper la página
    return { weaknesses, plan: await this.ai.studyPlan(weaknesses, token) };
  }

  // [POST /ai/feedback/generate]: feedback ad-hoc sin pasar por flujo de submit | [Patrón]: Proxy
  @Post('generate')
  @ApiOperation({
    summary: 'Generate pedagogical feedback (proxies to FastAPI)',
  })
  async generate(
    @Body() body: GenerateFeedbackBody,
    @Headers('authorization') auth: string,
  ): Promise<FeedbackResult | null> {
    const token = (auth ?? '').replace(/^Bearer\s+/i, '');
    return this.ai.generateFeedback(
      {
        questionId: body.questionId,
        questionText: body.questionText,
        correctAnswer: body.correctAnswer,
        userAnswer: body.userAnswer,
        topic: body.topic,
        language: body.language,
      },
      token,
    );
  }
}
