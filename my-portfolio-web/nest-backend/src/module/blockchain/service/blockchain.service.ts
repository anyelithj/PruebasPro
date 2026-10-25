// [FACADE][SRP] invoca el agente blockchain de FastAPI por gRPC. No toca HTTP.
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';
import {
  BLOCKCHAIN_PACKAGE,
  BlockchainEvent,
  BlockchainServiceGrpc,
} from 'src/infrastructure/grpc/blockchain-grpc.client';
import { BlockchainRequestDto } from '../dto/blockchain-request.dto';
import { BlockchainResponseDto } from '../dto/blockchain-response.dto';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private grpc!: BlockchainServiceGrpc;

  constructor(@Inject(BLOCKCHAIN_PACKAGE) private readonly client: ClientGrpc) {}

  onModuleInit(): void {
    this.grpc = this.client.getService<BlockchainServiceGrpc>('BlockchainService');
  }

  // Unario: espera la respuesta final del agente.
  async invoke(dto: BlockchainRequestDto): Promise<BlockchainResponseDto> {
    const res = await firstValueFrom(
      this.grpc.Invoke({ message: dto.message, chain: dto.chain, wallet: dto.wallet }),
    );
    return {
      status: res.status,
      chain: res.chain,
      toolUsed: res.tool_used,
      agentResponse: res.agent_response,
      toolResult: this.parse(res.tool_result),
      txSignature: res.tx_signature || null,
      txHash: res.tx_hash || null,
      network: res.network,
      explorerUrl: res.explorer_url || null,
      timestamp: res.timestamp,
    };
  }

  // Streaming: reenvía el Observable de eventos del agente (para SSE / WS).
  stream(dto: BlockchainRequestDto): Observable<BlockchainEvent> {
    return this.grpc.Stream({ message: dto.message, chain: dto.chain, wallet: dto.wallet });
  }

  private parse(value: string): unknown {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
