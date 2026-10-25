// [MVC-C][SRP] entrada HTTP del chat — streaming/historial públicos + gestión admin.
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { ROLE_ADMIN } from 'src/common/constants/roles.constants';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import { SendMessageDto, sendMessageSchema } from '../dto/send-message.dto';
import {
  UpdateChatSettingsDto,
  updateChatSettingsSchema,
} from '../dto/update-chat-settings.dto';
import { ChatService } from '../service/chat.service';
import { CHAT_ROUTES } from '../route/chat.routes';

@Controller(CHAT_ROUTES.ROOT)
@UseGuards(RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ---------- Público (visitante) ----------

  @Get(CHAT_ROUTES.HISTORY)
  @Public()
  async history(@Param('sessionId') sessionId: string) {
    const messages = await this.chatService.history(sessionId);
    return {
      success: true,
      data: messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
      })),
    };
  }

  // [OBSERVER] Server-Sent Events — un `data:` por token del modelo.
  @Post(CHAT_ROUTES.STREAM)
  @Public()
  async stream(
    @Body(new ZodValidationPipe(sendMessageSchema)) dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    for await (const event of this.chatService.stream(dto)) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  }

  // ---------- Admin (gestión del chat) ----------

  // System prompt actual (el "guion" del asistente).
  @Get(CHAT_ROUTES.SETTINGS)
  @Roles(ROLE_ADMIN)
  async getSettings() {
    return {
      success: true,
      data: { systemPrompt: await this.chatService.getSystemPrompt() },
    };
  }

  @Patch(CHAT_ROUTES.SETTINGS)
  @Roles(ROLE_ADMIN)
  async updateSettings(
    @Body(new ZodValidationPipe(updateChatSettingsSchema)) dto: UpdateChatSettingsDto,
  ) {
    await this.chatService.setSystemPrompt(dto.systemPrompt);
    return { success: true, data: { systemPrompt: dto.systemPrompt }, message: 'System prompt actualizado' };
  }

  // Lista de conversaciones (sesiones) con nº de mensajes y última actividad.
  @Get(CHAT_ROUTES.SESSIONS)
  @Roles(ROLE_ADMIN)
  async sessions() {
    return { success: true, data: await this.chatService.listSessions() };
  }

  // Borra una conversación completa.
  @Delete(CHAT_ROUTES.HISTORY)
  @Roles(ROLE_ADMIN)
  async removeSession(@Param('sessionId') sessionId: string) {
    const deleted = await this.chatService.deleteSession(sessionId);
    return { success: true, data: { deleted }, message: 'Conversación eliminada' };
  }
}
