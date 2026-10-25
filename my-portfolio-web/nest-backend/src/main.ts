// [CC-F2] bootstrap mínimo; delega configuración
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody: true — necesario para validar la firma HMAC de los webhooks.
  const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
  const config = app.get(ConfigService);

  const apiPrefix = config.get<string>('app.apiPrefix') ?? 'api/v1';
  const port = config.get<number>('app.port') ?? 3000;
  const corsOrigins = config.get<string[]>('app.corsOrigins') ?? [];

  app.setGlobalPrefix(apiPrefix, { exclude: ['health'] });
  app.enableCors({ origin: corsOrigins.length ? corsOrigins : true, credentials: true });
  app.enableShutdownHooks();

  await app.listen(port);
  Logger.log(`API up on :${port}/${apiPrefix}`, 'Bootstrap');
}

void bootstrap();
