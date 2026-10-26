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
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { bearer } from '../../ai/assistant.controller';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  CreateReadingBody,
  DraftReadingBody,
  ExportQuery,
  ListReadingQuery,
  ProgressBody,
  ReadingStatusBody,
  UpdateReadingBody,
  UpdateSentenceBody,
} from '../application/dtos/reading.dto';
import { CreateReadingTextUseCase } from '../application/use-cases/create-reading-text.use-case';
import { DraftReadingUseCase } from '../application/use-cases/draft-reading.use-case';
import { EnrichReadingTextUseCase } from '../application/use-cases/enrich-reading-text.use-case';
import { ExportReadingTextUseCase } from '../application/use-cases/export-reading-text.use-case';
import { GetReadingTextUseCase } from '../application/use-cases/get-reading-text.use-case';
import { ListReadingTextsUseCase } from '../application/use-cases/list-reading-texts.use-case';
import type { ReadingActor } from '../application/use-cases/reading-access';
import { SaveReadingProgressUseCase } from '../application/use-cases/reading-progress.use-case';
import { UpdateReadingTextUseCase } from '../application/use-cases/update-reading-text.use-case';
import { UpdateSentenceUseCase } from '../application/use-cases/update-sentence.use-case';
import { WithdrawReadingTextUseCase } from '../application/use-cases/withdraw-reading-text.use-case';
// [Controller ReadingTexts · Lectura · 2026-10-25]: textos de lectura — borrador con IA, crear, editar frases, completar IPA/traducción, publicar y retirar (TEACHER/ADMIN); listar, leer, marcador y descarga (todos con sesión) | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio (@Roles + ReadingAccess por fila) | [Tecnología]: NestJS + Swagger + Throttler
// [Orden]: «draft» antes de «:id» (si no, POST /reading/texts/draft no llegaría) · [Seguridad]: ids con ParseUUIDPipe · JwtAuthGuard global

const actorOf = (u: JwtPayload): ReadingActor => ({ id: u.sub, role: u.role });
const flag = (v?: string) => v === 'true' || v === '1';

@ApiTags('reading')
@ApiBearerAuth()
@Controller('reading/texts')
export class ReadingTextsController {
  constructor(
    private readonly draftUc: DraftReadingUseCase,
    private readonly createUc: CreateReadingTextUseCase,
    private readonly listUc: ListReadingTextsUseCase,
    private readonly getUc: GetReadingTextUseCase,
    private readonly updateUc: UpdateReadingTextUseCase,
    private readonly sentenceUc: UpdateSentenceUseCase,
    private readonly enrichUc: EnrichReadingTextUseCase,
    private readonly withdrawUc: WithdrawReadingTextUseCase,
    private readonly progressUc: SaveReadingProgressUseCase,
    private readonly exportUc: ExportReadingTextUseCase,
  ) {}

  // [Throttle]: la IA local es cara (CPU/RAM) → 6 borradores por minuto y usuario/IP
  @Post('draft')
  @HttpCode(200)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: 'Borrador de lectura con la IA local (género, nivel, tema, longitud; opcional: material importado) — no guarda' })
  draft(@Body() body: DraftReadingBody) {
    return this.draftUc.execute(body);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Crear lectura (borrador): divide en frases y añade traducción e IPA por lotes' })
  create(@CurrentUser() u: JwtPayload, @Body() body: CreateReadingBody, @Headers('authorization') auth: string) {
    return this.createUc.execute(actorOf(u), body, bearer(auth));
  }

  @Get()
  @ApiOperation({ summary: 'Lecturas por idioma, nivel y género (publicadas · mine=true: Gestión)' })
  list(@CurrentUser() u: JwtPayload, @Query() q: ListReadingQuery) {
    return this.listUc.execute(actorOf(u), { language: q.language, level: q.level, genre: q.genre, mine: flag(q.mine) });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lectura con frases, traducción, IPA y el marcador del usuario' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.getUc.execute(actorOf(u), id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Editar metadatos, estado o el texto completo (re-divide en frases conservando las traducciones sin cambios)' })
  update(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateReadingBody, @Headers('authorization') auth: string) {
    return this.updateUc.execute(actorOf(u), id, body, bearer(auth));
  }

  @Patch(':id/status')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Publicar (visible para estudiantes) o despublicar (borrador)' })
  status(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: ReadingStatusBody) {
    return this.updateUc.status(actorOf(u), id, body.status);
  }

  @Post(':id/enrich')
  @HttpCode(200)
  @Roles(Role.TEACHER, Role.ADMIN)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Completar IPA y traducción de las frases que no la tienen (force=true: recalcular las no revisadas)' })
  enrich(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Headers('authorization') auth: string, @Query('force') force?: string) {
    return this.enrichUc.execute(actorOf(u), id, bearer(auth), flag(force));
  }

  @Patch(':id/sentences/:sentenceId')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Corregir una frase, su traducción o su IPA' })
  sentence(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('sentenceId', ParseUUIDPipe) sentenceId: string,
    @Body() body: UpdateSentenceBody,
    @Headers('authorization') auth: string,
  ) {
    return this.sentenceUc.execute(actorOf(u), id, sentenceId, body, bearer(auth));
  }

  @Patch(':id/progress')
  @ApiOperation({ summary: 'Guardar el marcador de lectura (frase y palabra)' })
  progress(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Body() body: ProgressBody) {
    return this.progressUc.execute(actorOf(u), id, body);
  }

  @Delete(':id/progress')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar el marcador (empezar de nuevo)' })
  resetProgress(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.progressUc.reset(actorOf(u), id);
  }

  // `@Res()`: respuesta binaria (no pasa por el envelope JSON) · `attachment` → el navegador descarga
  @Get(':id/export')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Descargar la lectura en PDF o TXT (original + traducción + IPA a elección)' })
  async export(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string, @Query() q: ExportQuery, @Res() res: Response): Promise<void> {
    const file = await this.exportUc.execute(actorOf(u), id, q.format ?? 'pdf', q.include ?? ['translation', 'ipa']);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(file.body);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Retirar la lectura (borrado lógico)' })
  remove(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.withdrawUc.execute(actorOf(u), id);
  }
}
