import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { CefrLevel } from '../../../shared/domain/cefr-level.vo';
import { Language } from '../../../shared/domain/language.vo';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  GameDecksUseCase,
  MAX_DECK_ITEMS,
} from '../application/use-cases/game-decks.use-case';
import { GAME_TYPES, type GameType } from '../domain/game-type';
// [GameDecksController · 2026-10-25]: /games/decks — juegos de vocabulario con material propio (Gestión → Actividades → Juegos) | [Patrón]: Thin Controller + DTO validado | [Principio]: SRP + Least Privilege (@Roles)

// Juegos que se juegan con una lista de palabras (familia «vocab» de GAME_META)
const DECK_GAMES = GAME_TYPES.filter((t) =>
  ['flashcards', 'memory', 'bingo', 'quick_sort', 'recovery_drills'].includes(
    t,
  ),
);

export class DeckItemBody {
  @IsString() @MinLength(1) @MaxLength(80) term!: string;
  @IsOptional() @IsString() @MaxLength(120) translation?: string;
  @IsOptional() @IsString() @MaxLength(8) emoji?: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
}

export class CreateDeckBody {
  @IsIn(DECK_GAMES) gameType!: GameType;
  @IsString() @MinLength(2) @MaxLength(160) title!: string;
  @IsEnum(Language) language!: Language;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel;
  @IsArray()
  @ArrayMaxSize(MAX_DECK_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => DeckItemBody)
  items!: DeckItemBody[];
}

export class UpdateDeckBody {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(160) title?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DECK_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => DeckItemBody)
  items?: DeckItemBody[];
  @IsOptional() @IsIn(['draft', 'published']) status?: 'draft' | 'published';
}

export class DraftDeckBody {
  @IsIn(DECK_GAMES) gameType!: GameType;
  @IsEnum(Language) language!: Language;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel;
  @IsString() @MinLength(2) @MaxLength(160) topic!: string;
  @IsInt() @Min(4) @Max(30) count!: number;
  @IsOptional() @IsString() @MaxLength(20_000) sourceText?: string;
}

const actorOf = (u: JwtPayload) => ({ id: u.sub, role: u.role });

@ApiTags('games')
@ApiBearerAuth()
@Controller('games/decks')
export class GameDecksController {
  constructor(private readonly decks: GameDecksUseCase) {}

  @Get()
  @ApiOperation({
    summary: 'Juegos con material propio (publicados · mine=true: Gestión)',
  })
  list(@CurrentUser() u: JwtPayload, @Query('mine') mine?: string) {
    return this.decks.list(actorOf(u), mine === 'true' || mine === '1');
  }

  @Post('draft')
  @HttpCode(200)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Borrador de palabras con IA (no guarda nada)' })
  draft(@Body() body: DraftDeckBody) {
    return this.decks.draft(body);
  }

  @Get(':id')
  get(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.decks.get(actorOf(u), id);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Crear un juego con material propio (borrador)' })
  create(@CurrentUser() u: JwtPayload, @Body() body: CreateDeckBody) {
    return this.decks.create(actorOf(u), body);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  update(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateDeckBody,
  ) {
    return this.decks.update(actorOf(u), id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  remove(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.decks.archive(actorOf(u), id);
  }
}
