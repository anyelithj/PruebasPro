import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { bearer } from '../../ai/assistant.controller';
import { AskGuideUseCase } from '../application/use-cases/ask-guide.use-case';
import {
  DeleteConversationUseCase,
  GetGuideConversationUseCase,
} from '../application/use-cases/delete-conversation.use-case';
import { RateGuideAnswerUseCase } from '../application/use-cases/rate-guide-answer.use-case';
import { HELP_LOCALES, type HelpLocale } from '../domain/entities/faq.entity';
import type { GuideAnsweredBy } from '../domain/entities/guide-feedback.entity';
// [Controller Guide · Sprint 7.10 · RF-96]: Agente Guía (JSON y SSE), conversación propia (leer/borrar) y valoración | [Patrón]: Thin Controller + Proxy (streaming) | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores
// [Límite de peticiones]: 10 preguntas por minuto y usuario/IP (el LLM local es caro) — informe cap. 15

const ROUTE = /^\/[\w\-/]*$/; // Solo rutas internas del portal (misma regla que FastAPI)
const LIMIT = { default: { limit: 10, ttl: 60_000 } };

export class AskGuideBody {
  @IsString() @MinLength(2) @MaxLength(1000) message!: string;
  @IsOptional() @IsUUID() sessionId?: string;
  @IsOptional() @Matches(ROUTE) @MaxLength(200) route?: string;
  @IsIn(HELP_LOCALES) locale!: HelpLocale;
  // [2026-10-19]: modo del chatbot flotante (Tutor · Soporte · Guía); el tutor recibe idioma y nivel
  @IsOptional() @IsIn(['guide', 'support', 'tutor']) mode?: 'guide' | 'support' | 'tutor';
  @IsOptional() @IsIn(['en', 'fr', 'de', 'es', 'pt', 'zh', 'ru']) language?: string;
  @IsOptional() @IsIn(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) level?: string;
}

export class RateGuideBody {
  @IsInt() @Min(1) messageIndex!: number;
  @IsBoolean() helpful!: boolean;
  @IsIn(['faq', 'manual', 'llm', 'none']) answeredBy!: GuideAnsweredBy;
  @IsOptional() @Matches(ROUTE) @MaxLength(200) route?: string;
}

@ApiTags('help')
@ApiBearerAuth()
@Controller('help')
export class GuideController {
  constructor(
    private readonly ask: AskGuideUseCase,
    private readonly conversation: GetGuideConversationUseCase,
    private readonly remove: DeleteConversationUseCase,
    private readonly rate: RateGuideAnswerUseCase,
  ) {}

  @Post('ask')
  @Throttle(LIMIT)
  @ApiOperation({
    summary: 'Preguntar al Agente Guía (FAQ → manual → LLM, con citas)',
  })
  askOne(@Body() body: AskGuideBody, @Headers('authorization') auth: string) {
    return this.ask.execute(body, bearer(auth));
  }

  // [SSE por POST]: igual que el tutor — la pregunta viaja en el cuerpo; `@Res()` canaliza el flujo sin envoltorio
  @Post('ask/stream')
  @Throttle(LIMIT)
  @ApiOperation({
    summary:
      'Preguntar al Agente Guía en streaming (session, token, sources, done)',
  })
  async askStream(
    @Body() body: AskGuideBody,
    @Headers('authorization') auth: string,
    @Res() res: Response,
  ): Promise<void> {
    const abort = new AbortController();
    res.on('close', () => abort.abort()); // Cliente desconectado → cancelar FastAPI
    const upstream = await this.ask.stream(body, bearer(auth), abort.signal);
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    upstream.pipe(res);
  }

  @Get('conversations/:sessionId')
  @ApiOperation({ summary: 'Mi conversación con el Agente Guía' })
  findConversation(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Headers('authorization') auth: string,
  ) {
    return this.conversation.execute(sessionId, bearer(auth));
  }

  // `:id` = sessionId de la conversación; el cuerpo indica qué respuesta se valora
  @Post('ask/:id/feedback')
  @ApiOperation({
    summary: 'Valorar una respuesta del Agente Guía (útil / no útil)',
  })
  rateOne(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() body: RateGuideBody,
    @Headers('authorization') auth: string,
  ) {
    return this.rate.execute(user.sub, sessionId, body, bearer(auth));
  }

  @Delete('conversations/:sessionId')
  @ApiOperation({ summary: 'Borrar mi conversación con el Agente Guía' })
  removeConversation(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Headers('authorization') auth: string,
  ) {
    return this.remove.execute(sessionId, bearer(auth));
  }
}
