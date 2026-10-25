// [MVC-C][SRP] proxy REST → agente blockchain de FastAPI (vía gRPC). Solo delega.
import { Body, Controller, Param, Post } from '@nestjs/common';
import { Public } from 'src/common/decorators/public.decorator';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation.pipe';
import {
  BlockchainRequestDto,
  blockchainRequestSchema,
} from '../dto/blockchain-request.dto';
import { BlockchainService } from '../service/blockchain.service';
import { BLOCKCHAIN_ROUTES } from '../route/blockchain.routes';

@Controller(BLOCKCHAIN_ROUTES.ROOT)
@Public()
export class BlockchainController {
  constructor(private readonly blockchainService: BlockchainService) {}

  @Post(BLOCKCHAIN_ROUTES.CHAT)
  chat(
    @Param('chain') chain: string,
    @Body(new ZodValidationPipe(blockchainRequestSchema.omit({ chain: true })))
    body: Omit<BlockchainRequestDto, 'chain'>,
  ) {
    const dto = blockchainRequestSchema.parse({ ...body, chain });
    return this.blockchainService.invoke(dto);
  }
}
