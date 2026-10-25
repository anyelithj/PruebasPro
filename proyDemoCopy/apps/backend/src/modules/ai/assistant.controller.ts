import { Body, Controller, Get, Headers, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { CefrLevel } from '../../shared/domain/cefr-level.vo';
import { Language } from '../../shared/domain/language.vo';
import { Role } from '../users/domain/value-objects/role.vo';
import {
  AssistantClientService,
  type ChatResult,
  type KnowledgeStatus,
} from './assistant-client.service';
// [AssistantController · Sprint 5.3]: proxy NestJS → tutor RAG de FastAPI | [Patrón]: Proxy + Thin Controller | [Principio]: SRP | [Paradigma]: POO

// [DTO]: class-validator → el ValidationPipe global rechaza mensajes vacíos o idiomas no soportados
export class ChatBody {
  @IsString() @MinLength(1) @MaxLength(2000) message!: string;
  @IsOptional() @IsUUID() sessionId?: string;
  @IsOptional() @IsEnum(Language) language?: Language;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel; // [Sprint 7.8]: nivel MCER → FastAPI gradúa la respuesta
}

// [bearer]: «Bearer xyz» → «xyz» para reenviarlo a FastAPI | `export` (Sprint 7.10): Help lo reutiliza (DRY)
export const bearer = (auth?: string): string =>
  (auth ?? '').replace(/^Bearer\s+/i, '');

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai/assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantClientService) {}

  @Post('chat')
  @ApiOperation({
    summary: 'Chat with the language tutor (RAG over approved curriculum)',
  })
  chat(
    @Body() body: ChatBody,
    @Headers('authorization') auth: string,
  ): Promise<ChatResult> {
    return this.assistant.chat(body, bearer(auth));
  }

  // [POST /ai/assistant/chat/stream · Sprint 5.3]: respuesta del tutor token a token (SSE) | `@Res()` (NestJS): respuesta manual → el flujo pasa tal cual, sin envoltorio ni buffer | [Patrón]: Proxy (streaming)
  // POST (no @Sse/GET): el mensaje viaja en el cuerpo; el cliente lee el flujo con fetch + ReadableStream
  @Post('chat/stream')
  @ApiOperation({
    summary: 'Chat with the tutor, streamed as Server-Sent Events',
  })
  async chatStream(
    @Body() body: ChatBody,
    @Headers('authorization') auth: string,
    @Res() res: Response,
  ): Promise<void> {
    const abort = new AbortController();
    res.on('close', () => abort.abort()); // Cliente desconectado → cancelar FastAPI
    const upstream = await this.assistant.chatStream(
      body,
      bearer(auth),
      abort.signal,
    );
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    upstream.pipe(res); // `pipe` (Node streams): contrapresión automática
  }

  @Get('knowledge')
  @ApiOperation({ summary: 'Tutor knowledge base status' })
  knowledge(@Headers('authorization') auth: string): Promise<KnowledgeStatus> {
    return this.assistant.knowledge(bearer(auth));
  }

  // [Solo ADMIN]: reconstruir el índice tras aprobar recursos nuevos
  @Post('knowledge/reindex')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Rebuild tutor index from approved curriculum items',
  })
  reindex(
    @Headers('authorization') auth: string,
  ): Promise<{ indexed: number; by_language: Record<string, number> }> {
    return this.assistant.reindex(bearer(auth));
  }
}
