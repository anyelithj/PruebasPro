import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { bearer } from '../../ai/assistant.controller';
import {
  SPEECH,
  type SpeechPort,
} from '../domain/interfaces/game-agent.interface';
import { WordStampBody } from './game-rounds.controller';
// [Controller Speech · Sprints 8.5/8.6 · RF-102/RF-104]: puerta de NestJS hacia FastAPI Speech — transcribir una grabación (multipart, en memoria, máx. 10 MB) y calcular métricas | [Patrón]: Thin Controller + Proxy | [Principio]: SRP + privacidad (el audio no se guarda) | [Tecnología]: Multer en memoria (@nestjs/platform-express)

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // [2026-10-23]: 25 MB → canciones MP3 / videos cortos para transcribir la letra
// [Archivo en memoria]: sin `dest` ni `storage`, Multer usa MemoryStorage → `buffer` disponible y nada en disco
interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
  size: number;
}
const AUDIO_MIME = /^(audio\/(webm|ogg|wav|x-wav|mpeg|mp3|mp4|x-m4a|aac)|video\/(mp4|webm|quicktime))(;.*)?$/; // [2026-10-23]: también video (Whisper decodifica la pista de audio con PyAV)

export class FluencyBody {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => WordStampBody)
  words!: WordStampBody[];
  @IsOptional() @IsNumber() @Min(0) promptEndS?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  targetVocabulary?: string[];
}

@ApiTags('speech')
@ApiBearerAuth()
@Controller('speech')
export class SpeechController {
  constructor(@Inject(SPEECH) private readonly speech: SpeechPort) {}

  @Post('transcribe')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Transcribir una grabación con marcas de tiempo por palabra',
  })
  // `FileInterceptor` sin destino (Multer en memoria): la grabación nunca toca el disco · `limits.fileSize`: corta subidas enormes
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_AUDIO_BYTES } }),
  )
  transcribe(
    @UploadedFile() file: UploadedAudio | undefined,
    @Body('language') language: string | undefined,
    @Headers('authorization') auth: string,
  ) {
    if (!file?.buffer?.length)
      throw new BadRequestException('Falta la grabación');
    if (!AUDIO_MIME.test(file.mimetype))
      throw new BadRequestException('Formato de audio no admitido');
    const lang =
      language && /^(en|fr|de|es|pt|zh|ru)$/.test(language)
        ? language
        : undefined;
    return this.speech.transcribe(
      file.buffer,
      file.mimetype,
      lang,
      bearer(auth),
    );
  }

  @Post('fluency')
  @ApiOperation({
    summary: 'Métricas de fluidez a partir de las marcas de tiempo',
  })
  fluency(@Body() body: FluencyBody, @Headers('authorization') auth: string) {
    return this.speech.fluency(
      {
        words: body.words,
        prompt_end_s: body.promptEndS ?? 0,
        target_vocabulary: body.targetVocabulary ?? [],
      },
      bearer(auth),
    );
  }
}
