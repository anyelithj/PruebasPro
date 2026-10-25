// [SRP] configuración gRPC aislada — servidor propio + cliente blockchain → FastAPI
import { join } from 'node:path';
import { registerAs } from '@nestjs/config';

export const grpcConfig = registerAs('grpc', () => ({
  host: process.env.GRPC_HOST ?? '0.0.0.0',
  port: parseInt(process.env.GRPC_PORT ?? '50051', 10),
  // Cliente gRPC hacia el agente blockchain de FastAPI.
  blockchain: {
    url: process.env.BLOCKCHAIN_GRPC_URL ?? 'localhost:50051',
    package: 'blockchain',
    protoPath: join(process.cwd(), 'proto', 'blockchain.proto'),
  },
}));
