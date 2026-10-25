// [OBSERVER][SRP] WebSocket gateway de chat IA — empuja cada chunk al cliente.
import { Logger, UseGuards } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsJwtGuard } from 'src/common/guards/ws-jwt.guard';
import { sendMessageSchema } from '../dto/send-message.dto';
import { ChatService } from '../service/chat.service';

@WebSocketGateway({ namespace: 'ws/chat', cors: true })
@UseGuards(WsJwtGuard)
export class ChatGateway {
  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  // Protocolo: cliente emite 'message' {content, sessionId, provider};
  // servidor emite 'event' por cada chunk/source/done/error.
  @SubscribeMessage('message')
  async onMessage(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const parsed = sendMessageSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit('event', { type: 'error', content: 'payload inválido' });
      return;
    }
    try {
      for await (const event of this.chatService.stream(parsed.data)) {
        client.emit('event', event);
      }
    } catch (e) {
      this.logger.error(`Chat WS error: ${(e as Error).message}`);
      client.emit('event', { type: 'error', content: 'error interno' });
    }
  }
}
