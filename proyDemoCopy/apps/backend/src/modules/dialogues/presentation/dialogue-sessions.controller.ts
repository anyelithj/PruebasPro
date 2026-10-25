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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { sendRanged } from '../../../shared/http/ranged-response';
import type { UploadedAudio } from '../../music/application/use-cases/upload-song-audio.use-case';
import {
  MAX_RECORDING_BYTES,
  TurnRecordingUseCase,
} from '../application/use-cases/turn-recording.use-case';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { bearer } from '../../ai/assistant.controller';
import {
  StartSessionBody,
  UserTurnBody,
} from '../application/dtos/dialogue.dto';
import { DeleteDialogueSessionUseCase } from '../application/use-cases/delete-dialogue-session.use-case';
import { EndDialogueSessionUseCase } from '../application/use-cases/end-dialogue-session.use-case';
import { GetDialogueSessionUseCase } from '../application/use-cases/get-dialogue-session.use-case';
import { ListDialogueSessionsUseCase } from '../application/use-cases/list-dialogue-sessions.use-case';
import { StartDialogueSessionUseCase } from '../application/use-cases/start-dialogue-session.use-case';
import { SubmitUserTurnUseCase } from '../application/use-cases/submit-user-turn.use-case';
// [Controller DialogueSessions · Sprints 9.3/9.12 · RF-122/RF-124]: conversación con el avatar — iniciar, listar las propias, ver la transcripción, enviar turno (JSON o SSE), terminar y borrar | [Patrón]: Thin Controller + Observer (SSE) | [Principio]: SRP + privacidad (solo las del JWT) | [Tecnología]: NestJS + Express (text/event-stream sin buffer)

const sse = (res: Response, event: string, data: unknown) =>
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

@ApiTags('dialogues')
@ApiBearerAuth()
@Controller('dialogues/sessions')
export class DialogueSessionsController {
  constructor(
    private readonly start: StartDialogueSessionUseCase,
    private readonly list: ListDialogueSessionsUseCase,
    private readonly get: GetDialogueSessionUseCase,
    private readonly submit: SubmitUserTurnUseCase,
    private readonly end: EndDialogueSessionUseCase,
    private readonly remove: DeleteDialogueSessionUseCase,
    private readonly recording: TurnRecordingUseCase,
  ) {}

  // [2026-10-20]: la grabación de voz del turno del usuario se guarda (antes solo se transcribía) → puede volver a escucharse
  @Post(':id/turns/:turnId/recording')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Guardar la grabación de voz de un turno propio (máx. 10 MB)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_RECORDING_BYTES } }))
  saveRecording(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('turnId', ParseUUIDPipe) turnId: string,
    @UploadedFile() file: UploadedAudio,
  ) {
    return this.recording.save(u.sub, id, turnId, file);
  }

  @Get(':id/turns/:turnId/recording')
  @ApiOperation({ summary: 'Escuchar la grabación de un turno propio (Range/206)' })
  async playRecording(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('turnId', ParseUUIDPipe) turnId: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const src = await this.recording.stream(u.sub, id, turnId);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    await sendRanged(res, range, src);
  }

  @Post()
  @ApiOperation({
    summary:
      'Iniciar conversación con el avatar (tema, idioma y nivel); el avatar abre',
  })
  startOne(
    @CurrentUser() u: JwtPayload,
    @Body() body: StartSessionBody,
    @Headers('authorization') auth: string,
  ) {
    return this.start.execute(u.sub, body, bearer(auth));
  }

  @Get('me')
  @ApiOperation({ summary: 'Conversaciones propias' })
  mine(@CurrentUser() u: JwtPayload) {
    return this.list.execute(u.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Transcripción con IPA y traducción lado a lado' })
  getOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(u.sub, id);
  }

  @Post(':id/turns')
  @ApiOperation({
    summary:
      'Enviar lo que dijo el usuario y recibir la respuesta del avatar (la grabación se guarda aparte en /recording)',
  })
  turn(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UserTurnBody,
    @Headers('authorization') auth: string,
  ) {
    return this.submit.execute(u.sub, id, body.text, bearer(auth));
  }

  // [SSE]: el turno del usuario llega primero; luego la respuesta del avatar palabra a palabra y al final el turno completo con IPA y traducción
  @Post(':id/turns/stream')
  @ApiOperation({
    summary: 'Igual que /turns pero en streaming (text/event-stream)',
  })
  async turnStream(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UserTurnBody,
    @Headers('authorization') auth: string,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no'); // Sin buffer en proxies (nginx, BFF de Next.js)
    res.flushHeaders();
    try {
      const out = await this.submit.execute(u.sub, id, body.text, bearer(auth));
      sse(res, 'user', out.userTurn);
      for (const token of out.avatarTurn.text.match(/\S+\s*/g) ?? [])
        sse(res, 'token', { text: token });
      sse(res, 'avatar', {
        ...out.avatarTurn,
        vocabularyUsed: out.vocabularyUsed,
        ended: out.ended, // [2026-10-23]: el cliente muestra «¡Diálogo terminado!» sin otra petición
      });
      sse(res, 'done', {});
    } catch (err) {
      sse(res, 'error', {
        message: err instanceof Error ? err.message : 'Error',
      });
    }
    res.end();
  }

  @Patch(':id/end')
  @ApiOperation({
    summary: 'Terminar la conversación (logros por evento en Score)',
  })
  endOne(@CurrentUser() u: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.end.execute(u.sub, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Borrar la conversación propia (privacidad)' })
  removeOne(
    @CurrentUser() u: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remove.execute(u.sub, id);
  }
}
