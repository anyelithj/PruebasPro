import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { CefrLevel } from '../../../shared/domain/cefr-level.vo';
import { Language } from '../../../shared/domain/language.vo';
import { bearer } from '../../ai/assistant.controller';
import { CancelGameSessionUseCase } from '../application/use-cases/cancel-game-session.use-case';
import { FinishGameSessionUseCase } from '../application/use-cases/finish-game-session.use-case';
import { GetGameSessionUseCase } from '../application/use-cases/get-game-session.use-case';
import { ListMySessionsUseCase } from '../application/use-cases/list-my-sessions.use-case';
import { PlayAgentTurnUseCase } from '../application/use-cases/play-agent-turn.use-case';
import {
  StartGameSessionUseCase,
  toView,
} from '../application/use-cases/start-game-session.use-case';
import { GAME_TYPES, type GameType } from '../domain/game-type';
import { GameCatalogUseCase } from '../application/use-cases/game-catalog.use-case';
// [Controller GameSessions · Sprint 8.5 · RF-98/RF-100/RF-101]: catálogo, iniciar, listar, ver, terminar y abandonar partidas + turno contra el agente | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (todo por el usuario del token) | [Paradigma]: POO + Decoradores

export class StartGameBody {
  @IsIn(GAME_TYPES) gameType!: GameType;
  @IsEnum(Language) language!: Language;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel;
  @IsOptional() @IsInt() @Min(1) @Max(3) difficulty?: number;
  @IsOptional() @IsUUID() scenarioId?: string;
  @IsOptional() @IsUUID() deckId?: string; // [2026-10-25]: juego con material propio
}

export class AgentTurnBody {
  @IsUUID() sessionId!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  message!: string;
  @IsOptional() @IsInt() @Min(0) @Max(600_000) timeToAnswerMs?: number;
}

@ApiTags('games')
@ApiBearerAuth()
@Controller('games')
export class GameSessionsController {
  constructor(
    private readonly start: StartGameSessionUseCase,
    private readonly listMine: ListMySessionsUseCase,
    private readonly get: GetGameSessionUseCase,
    private readonly finish: FinishGameSessionUseCase,
    private readonly cancel: CancelGameSessionUseCase,
    private readonly agentTurn: PlayAgentTurnUseCase,
    private readonly catalog: GameCatalogUseCase,
  ) {}

  // [2026-10-24]: GET /games/catalog vive ahora en GameCatalogController (con títulos, descripciones y estado editables)

  @Post('sessions')
  @ApiOperation({
    summary:
      'Iniciar una partida (tipo, idioma, nivel, dificultad o escenario)',
  })
  async startOne(@CurrentUser() u: JwtPayload, @Body() body: StartGameBody) {
    await this.catalog.assertPlayable({ id: u.sub, role: u.role }, body.gameType); // [2026-10-24]: juego archivado o en borrador → 403
    return toView(await this.start.execute(u.sub, body));
  }

  @Get('sessions/me')
  @ApiOperation({ summary: 'Mis partidas con puntaje' })
  mine(@CurrentUser() u: JwtPayload) {
    return this.listMine.execute(u.sub);
  }

  @Get('sessions/:id')
  @ApiOperation({
    summary: 'Resumen de la partida: rondas y métricas de fluidez',
  })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(u.sub, id);
  }

  @Patch('sessions/:id/finish')
  @ApiOperation({ summary: 'Terminar la partida y calcular el puntaje' })
  finishOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.finish.execute(u.sub, id);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Abandonar una partida en curso' })
  cancelOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cancel.execute(u.sub, id);
  }

  @Post('agent/turn')
  @ApiOperation({
    summary:
      'Jugada del usuario → turno del agente de juegos (motor determinista primero)',
  })
  turn(
    @CurrentUser() u: JwtPayload,
    @Body() body: AgentTurnBody,
    @Headers('authorization') auth: string,
  ) {
    return this.agentTurn.execute(
      u.sub,
      body.sessionId,
      body.message,
      bearer(auth),
      body.timeToAnswerMs,
    );
  }
}
