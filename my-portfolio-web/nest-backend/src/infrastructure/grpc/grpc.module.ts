// [SRP] módulo gRPC independiente — STUB (vertical slice). Estructura reservada.
// Previsto: auth-grpc.controller.ts [ADAPTER], chat-grpc.controller.ts [ADAPTER]
// + microservicio transport (proto/ auth.proto, chat.proto, ...).
import { Module } from '@nestjs/common';

@Module({})
export class GrpcModule {}
