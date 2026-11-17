import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CefrLevel } from '../../shared/domain/cefr-level.vo';
import {
  Language,
  LANGUAGES_OR_AUTO,
  type LanguageOrAuto,
} from '../../shared/domain/language.vo';
import {
  OwnLlmClientService,
  type CorrectorResult,
  type SpeechOrigin,
  type TextKind,
  type WritingCorrection,
  type WritingScope,
} from './own-llm-client.service';
// [OwnLlmController · Sprint 5.6 · RF-144]: puerta pública /ai/own-llm/* del corrector de redacciones (FastAPI hace el trabajo) | [Patrón]: Proxy + Thin Controller | [Principio]: SRP | [Paradigma]: POO

// [DTO]: class-validator → el ValidationPipe global rechaza textos vacíos o fuera de alcance antes de llamar a FastAPI | [Principio]: Fail Fast
// El alcance (7 idiomas · A1–C2, mismos enums del Shared Kernel) se valida otra vez en FastAPI, que es su fuente de verdad (GET /ai/own-llm/scope)
export class WritingCorrectionBody {
  @IsString() @MinLength(3) @MaxLength(2000) text!: string;
  // [Detectar idioma · 2026-10-27]: «auto» (por defecto en la UI, como GrammarMama) → FastAPI detecta el idioma y lo devuelve en `detected_language`
  @IsIn(LANGUAGES_OR_AUTO) language!: LanguageOrAuto;
  @IsEnum(CefrLevel) level!: CefrLevel;
  // [2026-11-11]: lo que preguntó el avatar → la corrección tiene en cuenta el contexto («my niece is Laura» ante «What's your name?»)
  @IsOptional() @IsString() @MaxLength(400) context?: string;
}

// [DTO Anexo A · 2026-11-13]: entrada del corrector pedagógico único (mismos nombres que el Anexo A) | [Principio]: Fail Fast
export class SentenceCorrectionBody {
  @IsOptional() @IsString() @MaxLength(400) pregunta_previa?: string;
  @IsString() @MinLength(1) @MaxLength(2000) texto!: string;
  @IsEnum(Language) idioma!: Language; // Los 7 idiomas (Shared Kernel)
  @IsEnum(CefrLevel) nivel!: CefrLevel;
  @IsOptional() @IsString() @MaxLength(200) tema?: string;
  @IsOptional()
  @IsIn(['frase', 'titulo', 'expresion'])
  tipo_de_texto?: TextKind;
  @IsOptional() @IsIn(['voz', 'escrito']) origen?: SpeechOrigin;
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

  // [POST /ai/own-llm/corrections · Anexo A]: revisión previa al envío (Diálogos y Redacción) con el MISMO corrector que puntúa el turno
  @Post('corrections')
  @ApiOperation({
    summary:
      'Corrector pedagógico único (Anexo A): corrección, veredicto, puntuación y traducción',
  })
  correctSentence(
    @Body() body: SentenceCorrectionBody,
    @Headers('authorization') auth: string,
  ): Promise<CorrectorResult> {
    return this.ownLlm.correctSentence(body, bearer(auth));
  }

  @Get('scope')
  @ApiOperation({ summary: 'Languages and CEFR levels the corrector supports' })
  scope(@Headers('authorization') auth: string): Promise<WritingScope> {
    return this.ownLlm.scope(bearer(auth));
  }
}
