import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { bearer } from '../../ai/assistant.controller';
import {
  GetRoundUseCase,
  ListRoundsUseCase,
} from '../application/use-cases/list-rounds.use-case';
import { SubmitRoundUseCase } from '../application/use-cases/submit-round.use-case';
// [Controller GameRounds · Sprint 8.5 · RF-105]: enviar la respuesta de una ronda (con tiempos y, si fue oral, marcas de voz), listar y ver rondas | [Patrón]: Thin Controller | [Principio]: SRP | [Paradigma]: POO + Decoradores

export class WordStampBody {
  @IsString() @MaxLength(60) word!: string;
  @IsNumber() @Min(0) start!: number;
  @IsNumber() @Min(0) end!: number;
}

export class SubmitRoundBody {
  @IsString() @MaxLength(4000) answer!: string;
  @IsOptional() @IsString() @MaxLength(1000) prompt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) entryIndex?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) lineIndex?: number;
  @IsOptional()
  @IsIn(['term', 'translation', 'category'])
  expected?: // [Sprint 8.8]: 'category' = clasificación rápida
    'term' | 'translation' | 'category';
  @IsOptional() @IsInt() @Min(0) @Max(600_000) timeToAnswerMs?: number;
  @IsOptional() @IsInt() @Min(0) @Max(600_000) durationMs?: number;
  @IsOptional() @IsNumber() @Min(0) promptEndS?: number;
  // `@ValidateNested` + `@Type` (class-transformer): valida cada marca de tiempo
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => WordStampBody)
  words?: WordStampBody[];
}

@ApiTags('games')
@ApiBearerAuth()
@Controller('games')
export class GameRoundsController {
  constructor(
    private readonly submit: SubmitRoundUseCase,
    private readonly list: ListRoundsUseCase,
    private readonly get: GetRoundUseCase,
  ) {}

  @Post('sessions/:id/rounds')
  @ApiOperation({ summary: 'Registrar y evaluar la respuesta de una ronda' })
  submitOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SubmitRoundBody,
    @Headers('authorization') auth: string,
  ) {
    return this.submit.execute(u.sub, id, body, bearer(auth));
  }

  @Get('sessions/:id/rounds')
  @ApiOperation({ summary: 'Rondas de la partida con resultado y tiempos' })
  listOf(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.list.execute(u.sub, id);
  }

  @Get('rounds/:id')
  @ApiOperation({ summary: 'Detalle de una ronda' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(u.sub, id);
  }
}
