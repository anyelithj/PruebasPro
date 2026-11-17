import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  CurrentUser,
  type JwtPayload,
} from '../../../shared/decorators/current-user.decorator';
import { bearer } from '../assistant.controller';
import { TUTOR_TITLE_MAX } from './tutor-conversation.entity';
import { TutorConversationService } from './tutor-conversation.service';
// [TutorConversationsController · 2026-10-28]: CRUD de las conversaciones del Tutor IA — listar, leer, renombrar y borrar conversación; editar (regenera la respuesta) y borrar mensaje | [Patrón]: Thin Controller (REST) | [Principio]: SRP + mínimo privilegio (el id del usuario sale SIEMPRE del JWT) | [Paradigma]: POO + Decoradores
// [Rutas]: /ai/assistant/conversations[/:id[/messages/:messageId]] · `ParseUUIDPipe` → 400 ante ids mal formados (sin tocar la BD)

const NOT_BLANK = /\S/; // Al menos un carácter visible (rechaza «   »)

export class RenameConversationBody {
  @IsString() @MinLength(1) @MaxLength(TUTOR_TITLE_MAX) @Matches(NOT_BLANK) title!: string;
}

export class EditMessageBody {
  @IsString() @MinLength(1) @MaxLength(2000) @Matches(NOT_BLANK) content!: string; // Mismo límite que ChatBody
}

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai/assistant/conversations')
export class TutorConversationsController {
  constructor(private readonly tutor: TutorConversationService) {}

  @Get()
  @ApiOperation({ summary: 'Mis conversaciones con el Tutor IA (más recientes primero)' })
  list(@CurrentUser() user: JwtPayload) {
    return this.tutor.list(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Una conversación con sus mensajes' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tutor.get(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renombrar una conversación' })
  rename(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RenameConversationBody,
  ) {
    return this.tutor.rename(user.sub, id, body.title);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Borrar una conversación y sus mensajes' })
  remove(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tutor.remove(user.sub, id);
  }

  // [Editar]: solo mensajes del alumno → se descartan los posteriores y el tutor responde de nuevo (llama al LLM)
  @Patch(':id/messages/:messageId')
  @ApiOperation({ summary: 'Editar un mensaje propio (regenera la respuesta del tutor)' })
  editMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() body: EditMessageBody,
    @Headers('authorization') auth: string,
  ) {
    return this.tutor.editMessage(user.sub, bearer(auth), id, messageId, body.content);
  }

  @Delete(':id/messages/:messageId')
  @ApiOperation({ summary: 'Borrar un mensaje de la conversación' })
  deleteMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Headers('authorization') auth: string,
  ) {
    return this.tutor.deleteMessage(user.sub, bearer(auth), id, messageId);
  }
}
