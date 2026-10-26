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
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { bearer } from '../../ai/assistant.controller';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  LinesPatchBody,
  LyricsBody,
  LyricsDraftBody,
  LyricsUrlBody,
} from '../application/dtos/song.dto';
import { DraftSongLyricsUseCase } from '../application/use-cases/draft-song-lyrics.use-case';
import { EnrichSongLinesUseCase } from '../application/use-cases/enrich-song-lines.use-case';
import { ImportLyricsFromUrlUseCase } from '../application/use-cases/import-lyrics-from-url.use-case';
import {
  GetSongLineUseCase,
  ListSongLinesUseCase,
} from '../application/use-cases/list-song-lines.use-case';
import { ReplaceSongLinesUseCase } from '../application/use-cases/replace-song-lines.use-case';
import { SyncSongLinesUseCase } from '../application/use-cases/sync-song-lines.use-case';
import { MEDIA_LINK_RULES } from '../domain/media-links';
import { actorOf } from './songs.controller';
// [Controller SongLines · Sprints 9.2/9.9 · RF-117/RF-119]: letra por líneas — cargar (con traducción e IPA), listar, ver, corregir en lote (IPA, traducción y tiempos), proponer tiempos con Alignment y borrar para recargar
// [2026-10-24]: + leer la letra de un enlace (POST /music/lyrics/from-url) y generarla con IA (POST /music/lyrics/draft) — ninguna guarda: el docente revisa y carga | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Paradigma]: POO + Decoradores

@ApiTags('music')
@ApiBearerAuth()
@Controller('music')
export class SongLinesController {
  constructor(
    private readonly replace: ReplaceSongLinesUseCase,
    private readonly list: ListSongLinesUseCase,
    private readonly getLine: GetSongLineUseCase,
    private readonly enrich: EnrichSongLinesUseCase,
    private readonly sync: SyncSongLinesUseCase,
    private readonly fromUrl: ImportLyricsFromUrlUseCase,
    private readonly draftLyrics: DraftSongLyricsUseCase,
  ) {}

  @Post('lyrics/from-url')
  @HttpCode(200) // Consulta sin efectos (no crea recursos) → 200 en vez del 201 por defecto de @Post
  @Roles(Role.TEACHER, Role.ADMIN) // [Mínimo privilegio]: hace peticiones salientes → solo docentes y ADMIN
  @ApiOperation({
    summary:
      'Leer la letra de una página pública (Genius, Letras, AZLyrics…) — no guarda nada',
  })
  readFromUrl(@Body() body: LyricsUrlBody) {
    return this.fromUrl.execute(body.url);
  }

  // [GET /music/link-rules · 2026-10-24]: dominios de letras y de streaming (SSOT: domain/media-links.ts) → el asistente valida el enlace del audio ANTES de enviarlo
  @Get('link-rules')
  @Roles(Role.TEACHER, Role.ADMIN) // Solo lo usa el asistente de subida
  @ApiOperation({ summary: 'Dominios de páginas de letras y de streaming (validación del enlace del audio en el cliente)' })
  linkRules() {
    return MEDIA_LINK_RULES;
  }

  @Post('lyrics/draft')
  @HttpCode(200)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Borrador de letra ORIGINAL con IA por idioma, nivel y tema — el docente la revisa antes de cargarla',
  })
  draft(@Body() body: LyricsDraftBody) {
    return this.draftLyrics.execute(body);
  }

  @Post('songs/:id/lines')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Cargar la letra: se divide en líneas y se piden traducción al español e IPA',
  })
  load(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LyricsBody,
    @Headers('authorization') auth: string,
  ) {
    return this.replace.execute(actorOf(u), id, body.lyrics, bearer(auth), body.auto ?? true);
  }

  @Post('songs/:id/lines/enrich')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Volver a pedir traducción e IPA de las líneas no revisadas',
  })
  async reEnrich(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string,
  ) {
    // [2026-10-24]: mismo contrato que la carga ({ lines, enriched, missing }) → la UI reintenta solo lo que falta
    const { lines, missing } = await this.enrich.run(actorOf(u), id, bearer(auth));
    return { lines, enriched: missing === 0, missing };
  }

  @Post('songs/:id/lines/align')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Proponer inicio y fin de cada línea con el audio (no se guarda)',
  })
  propose(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string,
  ) {
    return this.sync.propose(actorOf(u), id, bearer(auth));
  }

  @Get('songs/:id/lines')
  @ApiOperation({
    summary: 'Líneas con texto original, IPA, traducción y tiempos',
  })
  listAll(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.list.execute(actorOf(u), id);
  }

  @Get('lines/:id')
  @ApiOperation({
    summary: 'Una línea con su IPA, su traducción y sus tiempos',
  })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.getLine.execute(actorOf(u), id);
  }

  @Patch('songs/:id/lines')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Lote: corregir IPA, traducción o tiempos (la corrección manual prevalece)',
  })
  patch(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: LinesPatchBody,
  ) {
    return this.sync.execute(actorOf(u), id, body.lines, body.timingSource);
  }

  @Delete('songs/:id/lines')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Borrar las líneas para volver a cargar la letra' })
  clear(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.replace.clear(actorOf(u), id);
  }
}
