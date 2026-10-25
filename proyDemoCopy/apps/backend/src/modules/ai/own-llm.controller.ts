import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { CefrLevel } from '../../shared/domain/cefr-level.vo';
import { Language } from '../../shared/domain/language.vo';
import {
  OwnLlmClientService,
  type WritingCorrection,
  type WritingScope,
} from './own-llm-client.service';
// [OwnLlmController · Sprint 5.6 · RF-144]: puerta pública /ai/own-llm/* del corrector de redacciones (FastAPI hace el trabajo) | [Patrón]: Proxy + Thin Controller | [Principio]: SRP | [Paradigma]: POO

// [DTO]: class-validator → el ValidationPipe global rechaza textos vacíos o fuera de alcance antes de llamar a FastAPI | [Principio]: Fail Fast
// El alcance (7 idiomas · A1–C2, mismos enums del Shared Kernel) se valida otra vez en FastAPI, que es su fuente de verdad (GET /ai/own-llm/scope)
export class WritingCorrectionBody {
  @IsString() @MinLength(3) @MaxLength(2000) text!: string;
  @IsEnum(Language) language!: Language;
  @IsEnum(CefrLevel) level!: CefrLevel;
}

const bearer = (auth?: string): string =>
  (auth ?? '').replace(/^Bearer\s+/i, '');

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai/own-llm')
export class OwnLlmController {
  constructor(private readonly ownLlm: OwnLlmClientService) {}

  @Post('writing-corrections')
  @ApiOperation({
    summary:
      'Correct a student writing with the own LLM (falls back to the base model)',
  })
  correct(
    @Body() body: WritingCorrectionBody,
    @Headers('authorization') auth: string,
  ): Promise<WritingCorrection> {
    return this.ownLlm.correct(body, bearer(auth));
  }

  @Get('scope')
  @ApiOperation({ summary: 'Languages and CEFR levels the corrector supports' })
  scope(@Headers('authorization') auth: string): Promise<WritingScope> {
    return this.ownLlm.scope(bearer(auth));
  }
}
