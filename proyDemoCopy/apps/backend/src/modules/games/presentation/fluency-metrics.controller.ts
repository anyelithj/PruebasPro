import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { bearer } from '../../ai/assistant.controller';
import { ClearMyFluencyUseCase } from '../application/use-cases/clear-my-fluency.use-case';
import {
  GetFluencyProgressUseCase,
  GetSessionFluencyUseCase,
} from '../application/use-cases/get-fluency-progress.use-case';
import { RecordFluencyMetricUseCase } from '../application/use-cases/record-fluency-metric.use-case';
import { OwnedSession } from '../application/use-cases/get-game-session.use-case';
import { WordStampBody } from './game-rounds.controller';
// [Controller FluencyMetrics · Sprint 8.5 · RF-102/RF-105]: registrar métricas de una ronda oral, serie temporal propia, métricas de una partida y borrado del historial | [Patrón]: Thin Controller | [Principio]: SRP + privacidad | [Paradigma]: POO + Decoradores

export class RecordFluencyBody {
  @IsUUID() sessionId!: string;
  @IsOptional() @IsUUID() roundId?: string;
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

@ApiTags('games')
@ApiBearerAuth()
@Controller('games/fluency')
export class FluencyMetricsController {
  constructor(
    private readonly record: RecordFluencyMetricUseCase,
    private readonly progress: GetFluencyProgressUseCase,
    private readonly ofSession: GetSessionFluencyUseCase,
    private readonly clear: ClearMyFluencyUseCase,
    private readonly owned: OwnedSession,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Guardar las métricas de una ronda oral (las calcula FastAPI Speech)',
  })
  async recordOne(
    @CurrentUser() u: JwtPayload,
    @Body() body: RecordFluencyBody,
    @Headers('authorization') auth: string,
  ) {
    await this.owned.load(u.sub, body.sessionId); // Solo en partidas propias
    return this.record.execute(u.sub, body, bearer(auth));
  }

  @Get('me')
  @ApiOperation({ summary: 'Serie diaria de mis métricas (from, to en ISO)' })
  mine(
    @CurrentUser() u: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.progress.execute(u.sub, from, to);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Métricas de una partida' })
  session(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ofSession.execute(u.sub, id);
  }

  @Delete('me')
  @ApiOperation({ summary: 'Borrar mi historial de métricas de fluidez' })
  clearMine(@CurrentUser() u: JwtPayload) {
    return this.clear.execute(u.sub);
  }
}
