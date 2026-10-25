import { IsUrl, MaxLength } from 'class-validator';
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
import { Role } from '../../users/domain/value-objects/role.vo';
import { CreateSongBody, SongStatusBody } from '../application/dtos/song.dto';
import { ChangeSongStatusUseCase } from '../application/use-cases/change-song-status.use-case';
import { CreateSongUseCase } from '../application/use-cases/create-song.use-case';
import {
  GetSongUseCase,
  type MusicActor,
} from '../application/use-cases/get-song.use-case';
import { ListSongsUseCase } from '../application/use-cases/list-songs.use-case';
import { StreamSongAudioUseCase } from '../application/use-cases/stream-song-audio.use-case';
import {
  fetchMediaUrl,
  MAX_SONG_AUDIO_BYTES,
  type UploadedAudio,
  UploadSongAudioUseCase,
} from '../application/use-cases/upload-song-audio.use-case';
import { WithdrawSongUseCase } from '../application/use-cases/withdraw-song.use-case';
import type { SongStatus } from '../domain/entities/song.entity';
// [Controller Songs · Sprint 9.2 · RF-115/RF-116/RF-119/RF-128]: canciones — crear con licencia y subir audio (TEACHER o ADMIN), listar y ver (todos), audio por rangos (206), revisión (autor → ADMIN) y retiro | [Patrón]: Thin Controller | [Principio]: SRP + mínimo privilegio | [Tecnología]: NestJS + Multer en memoria + Express streaming

export const actorOf = (u: JwtPayload): MusicActor => ({
  id: u.sub,
  role: u.role,
});

// [MediaUrlBody]: enlace del audio a importar | class-validator
export class MediaUrlBody {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(2000) url!: string;
}

@ApiTags('music')
@ApiBearerAuth()
@Controller('music/songs')
export class SongsController {
  constructor(
    private readonly create: CreateSongUseCase,
    private readonly uploadAudio: UploadSongAudioUseCase,
    private readonly list: ListSongsUseCase,
    private readonly get: GetSongUseCase,
    private readonly stream: StreamSongAudioUseCase,
    private readonly changeStatus: ChangeSongStatusUseCase,
    private readonly withdraw: WithdrawSongUseCase,
  ) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Crear canción con idioma, nivel y licencia (queda en borrador)',
  })
  createOne(@CurrentUser() u: JwtPayload, @Body() body: CreateSongBody) {
    return this.create.execute(actorOf(u), body);
  }

  @Post(':id/audio')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir el audio de la canción (máx. 20 MB)' })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_SONG_AUDIO_BYTES } }),
  ) // Multer en memoria → ObjectStore
  upload(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedAudio,
  ) {
    return this.uploadAudio.execute(actorOf(u), id, file);
  }

  // [2026-10-20]: «subir por URL» — enlace directo a un .mp3/.mp4…; se descarga en el servidor y sigue el mismo camino que una subida
  @Post(':id/audio/url')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Importar el audio de la canción desde un enlace directo (máx. 20 MB)' })
  async uploadFromUrl(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MediaUrlBody,
  ) {
    return this.uploadAudio.execute(actorOf(u), id, await fetchMediaUrl(body.url));
  }

  @Get()
  @ApiOperation({
    summary:
      'Canciones publicadas por idioma, nivel y colección (mine=true: las propias; ADMIN: status=review)',
  })
  listAll(
    @CurrentUser() u: JwtPayload,
    @Query('language') language?: string,
    @Query('level') level?: string,
    @Query('collection') collection?: string,
    @Query('status') status?: SongStatus,
    @Query('mine') mine?: string,
  ) {
    return this.list.execute(actorOf(u), {
      language,
      level,
      collection,
      status,
      mine: mine === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Canción con sus líneas, IPA, traducción y tiempos',
  })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(actorOf(u), id);
  }

  @Get(':id/audio')
  @ApiOperation({
    summary: 'Audio de la canción con Range/206 (o 302 a URL firmada)',
  })
  async audio(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const src = await this.stream.execute(actorOf(u), id);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    await sendRanged(res, range, src);
  }

  @Patch(':id/status')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Enviar a revisión (autor) · publicar o rechazar con motivo (ADMIN)',
  })
  status(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SongStatusBody,
  ) {
    return this.changeStatus.execute(actorOf(u), id, body.status, body.note);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary:
      'Retirar la canción y su audio (borrado lógico; también por derechos de autor)',
  })
  remove(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.withdraw.execute(actorOf(u), id);
  }
}
