// [OBSERVER][SRP] WS gateway → stream gRPC del agente blockchain de FastAPI.
import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { blockchainRequestSchema } from '../dto/blockchain-request.dto';
import { BlockchainService } from '../service/blockchain.service';

@WebSocketGateway({ namespace: 'ws/blockchain', cors: true })
export class BlockchainGateway {
  private readonly logger = new Logger(BlockchainGateway.name);

  constructor(private readonly blockchainService: BlockchainService) {}

  // cliente emite 'message' {message, chain, wallet}; servidor emite 'event' por cada chunk.
  @SubscribeMessage('message')
  onMessage(@MessageBody() payload: unknown, @ConnectedSocket() client: Socket): void {
    const parsed = blockchainRequestSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit('event', { type: 'error', content: 'payload inválido' });
      return;
    }
    const subscription = this.blockchainService.stream(parsed.data).subscribe({
      next: (event) => client.emit('event', event),
      error: (err: Error) => {
        this.logger.error(`Blockchain WS error: ${err.message}`);
        client.emit('event', { type: 'error', content: err.message });
      },
      complete: () => client.emit('event', { type: 'done' }),
    });
    client.on('disconnect', () => subscription.unsubscribe());
  }
}
