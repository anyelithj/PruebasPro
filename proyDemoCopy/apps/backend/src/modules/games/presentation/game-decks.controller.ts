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
  ValidateNested, Matches } from 'class-validator';
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

// [2026-11-11]: TODOS los juegos admiten material propio (antes solo los de vocabulario) → el contenido de cada ítem depende del juego (ver DeckItem)
const DECK_GAMES = GAME_TYPES;

export class DeckItemBody {
  @IsString() @MinLength(1) @MaxLength(200) term!: string; // [2026-11-11]: 80 → 200 (temas y frases de escucha)
  @IsOptional() @IsString() @MaxLength(120) translation?: string;
  @IsOptional() @IsString() @MaxLength(8) emoji?: string;
  // [2026-11-03]: imagen por enlace https (como Políglota) | [Seguridad]: solo https → sin javascript:/data: en el <img>
  // [2026-11-03]: miniatura WebP del navegador (data:image, igual que vocabulario · ≤ 150 000) o enlace https | [Seguridad]: sin javascript:/svg (no ejecutable)
  @IsOptional() @IsString() @MaxLength(150_000) @Matches(/^(https:\/\/\S{4,396}|data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)$/) image?: string;
  @IsOptional() @IsString() @MaxLength(40) category?: string;
  @IsOptional() @IsString() @MaxLength(200) words?: string;
  @IsOptional() @IsString() @MaxLength(200) question?: string;
  @IsOptional() @IsString() @MaxLength(80) answer?: string;
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

// [UpdateDeckBody · 2026-10-27]: «Editar» del juego en Gestión → también cambia de juego (mismo material) y de nivel | `@IsOptional` (class-validator): PATCH parcial
export class UpdateDeckBody {
  @IsOptional() @IsIn(DECK_GAMES) gameType?: GameType;
  @IsOptional() @IsEnum(CefrLevel) level?: CefrLevel;
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
  @ApiOperation({ summary: 'Detalle de un juego con material propio (palabras incluidas)' }) // [Sprint 11.2]: toda operación documentada en OpenAPI
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
  @Roles(Role.TEACHER, Role.ADMIN) // Mismo guard que crear; el caso de uso exige además ser el autor o ADMIN
  @ApiOperation({ summary: 'Editar un juego con material propio (título, juego, nivel, palabras o estado)' })
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
  @ApiOperation({ summary: 'Archivar un juego con material propio (borrado lógico)' })
  remove(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.decks.archive(actorOf(u), id);
  }
}
