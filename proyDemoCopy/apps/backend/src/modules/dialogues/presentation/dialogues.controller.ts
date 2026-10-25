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
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { Roles } from '../../../shared/decorators/roles.decorator';
import { sendRanged } from '../../../shared/http/ranged-response';
import { bearer } from '../../ai/assistant.controller';
import {
  MAX_SONG_AUDIO_BYTES,
  type UploadedAudio,
} from '../../music/application/use-cases/upload-song-audio.use-case';
import { actorOf } from '../../music/presentation/songs.controller';
import { Role } from '../../users/domain/value-objects/role.vo';
import {
  ConfirmLevelBody,
  CreateDialogueBody,
  DialogueStatusBody,
  DraftDialogueBody,
} from '../application/dtos/dialogue.dto';
import { DraftDialogueUseCase } from '../application/use-cases/draft-dialogue.use-case';
import { ConfirmDialogueLevelUseCase } from '../application/use-cases/confirm-dialogue-level.use-case';
import { GetDialogueUseCase } from '../application/use-cases/get-dialogue.use-case';
import { ListDialoguesUseCase } from '../application/use-cases/list-dialogues.use-case';
import { UploadDialogueUseCase } from '../application/use-cases/upload-dialogue.use-case';
import { WithdrawDialogueUseCase } from '../application/use-cases/withdraw-dialogue.use-case';
// [Controller Dialogues · Sprint 9.3 · RF-125 a RF-128]: biblioteca de diálogos guionados — subir con licencia (TEACHER o ADMIN; nivel estimado por FastAPI), audio opcional sincronizado, listar y ver (todos), confirmar el nivel (docente) y retirar | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio + verificación humana | [Tecnología]: NestJS + Multer en memoria + Express streaming

@ApiTags('dialogues')
@ApiBearerAuth()
@Controller('dialogues')
export class DialoguesController {
  constructor(
    private readonly upload: UploadDialogueUseCase,
    private readonly list: ListDialoguesUseCase,
    private readonly get: GetDialogueUseCase,
    private readonly confirm: ConfirmDialogueLevelUseCase,
    private readonly withdraw: WithdrawDialogueUseCase,
    private readonly draft: DraftDialogueUseCase,
  ) {}

  // [2026-10-19]: borrador desde el texto de una URL o generado por la IA (no guarda nada; el docente revisa y luego POST /dialogues)
  @Post('draft')
  @HttpCode(200)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Borrador de diálogo: lee el guion «Nombre: frase» del texto de una página o lo genera la IA (sin guardar)',
  })
  draftOne(@Body() body: DraftDialogueBody) {
    return this.draft.execute(body);
  }

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Subir diálogo (texto por hablante y licencia): traducción e IPA por turno y nivel estimado',
  })
  createOne(
    @CurrentUser() u: JwtPayload,
    @Body() body: CreateDialogueBody,
    @Headers('authorization') auth: string,
  ) {
    return this.upload.execute(actorOf(u), body, bearer(auth));
  }

  @Post(':id/audio')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Audio opcional del diálogo (máx. 20 MB): se sincroniza cada turno automáticamente',
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_SONG_AUDIO_BYTES } }),
  )
  audio(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedAudio,
    @Headers('authorization') auth: string,
  ) {
    return this.upload.audio(actorOf(u), id, file, bearer(auth));
  }

  @Get()
  @ApiOperation({
    summary:
      'Biblioteca por idioma, nivel y tema (mine=true: los propios · ADMIN pending=true: sin confirmar)',
  })
  listAll(
    @CurrentUser() u: JwtPayload,
    @Query('language') language?: string,
    @Query('level') level?: string,
    @Query('topic') topic?: string,
    @Query('mine') mine?: string,
    @Query('pending') pending?: string,
  ) {
    return this.list.execute(actorOf(u), {
      language,
      level,
      topic,
      mine: mine === 'true',
      pending: pending === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Diálogo con sus turnos, IPA y traducción lado a lado',
  })
  getOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') auth: string,
  ) {
    return this.get.execute(actorOf(u), id, bearer(auth)); // [2026-10-23]: token → relleno de traducciones faltantes
  }

  @Get(':id/audio')
  @ApiOperation({ summary: 'Audio del diálogo con Range/206' })
  async stream(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const src = await this.get.audio(actorOf(u), id);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    await sendRanged(res, range, src);
  }

  @Patch(':id/level')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Confirmar o cambiar el nivel estimado (queda «confirmado» y visible)',
  })
  level(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ConfirmLevelBody,
  ) {
    return this.confirm.execute(actorOf(u), id, body.level);
  }

  @Patch(':id/status')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Publicar (nivel confirmado, visible) o despublicar (vuelve a borrador) un diálogo' })
  status(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DialogueStatusBody,
  ) {
    return this.confirm.setStatus(actorOf(u), id, body.status); // [2026-10-24]
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Retirar el diálogo (borrado lógico)' })
  remove(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.withdraw.execute(actorOf(u), id);
  }
}
