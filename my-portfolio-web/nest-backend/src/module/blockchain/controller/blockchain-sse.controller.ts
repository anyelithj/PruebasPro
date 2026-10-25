// [SRP][CC-F2] proxy SSE — convierte el stream gRPC de FastAPI en text/event-stream.
import { Controller, Param, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from 'src/common/decorators/public.decorator';
import { blockchainRequestSchema } from '../dto/blockchain-request.dto';
import { BlockchainService } from '../service/blockchain.service';
import { BLOCKCHAIN_ROUTES } from '../route/blockchain.routes';

@Controller(BLOCKCHAIN_ROUTES.ROOT)
@Public()
export class BlockchainSseController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Post(BLOCKCHAIN_ROUTES.STREAM)
  stream(
    @Param('chain') chain: string,
    @Query('message') message: string,
    @Query('wallet') wallet: string | undefined,
    @Res() res: Response,
  ): void {
    const dto = blockchainRequestSchema.parse({ message, chain, wallet });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const subscription = this.blockchainService.stream(dto).subscribe({
      next: (event) => res.write(`data: ${JSON.stringify(event)}\n\n`),
      error: (err: Error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', content: err.message })}\n\n`);
        res.end();
      },
      complete: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      },
    });

    // Corta la suscripción gRPC si el cliente cierra la conexión.
    res.on('close', () => subscription.unsubscribe());
  }
}
