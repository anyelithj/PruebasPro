// [FACADE] cliente blockchain → FastAPI por gRPC — REST + SSE + WebSocket proxies.
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { BLOCKCHAIN_PACKAGE } from 'src/infrastructure/grpc/blockchain-grpc.client';
import { BlockchainSseController } from './controller/blockchain-sse.controller';
import { BlockchainController } from './controller/blockchain.controller';
import { BlockchainGateway } from './controller/blockchain.gateway';
import { BlockchainService } from './service/blockchain.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: BLOCKCHAIN_PACKAGE,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            url: config.get<string>('grpc.blockchain.url') ?? 'localhost:50051',
            package: config.get<string>('grpc.blockchain.package') ?? 'blockchain',
            protoPath:
              config.get<string>('grpc.blockchain.protoPath') ??
              'proto/blockchain.proto',
          },
        }),
      },
    ]),
  ],
  controllers: [BlockchainController, BlockchainSseController],
  providers: [BlockchainService, BlockchainGateway],
  exports: [BlockchainService],
})
export class BlockchainModule {}
