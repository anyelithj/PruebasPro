import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GLOBAL_VALIDATION_OPTIONS } from './shared/pipes/validation.pipe';
// [Bootstrap]: configura toda la app antes de listen | [Patrón]: Builder | [Principio]: SRP | [Paradigma]: POO + Imperativo

async function bootstrap(): Promise<void> {
  // [Logger raíz]: namespace identifica bootstrap en logs
  const logger = new Logger('Bootstrap');

  // [Crear app Nest]: bufferLogs colecta logs hasta tener config | [Patrón]: Factory
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true, // [Sprint 7.3]: guarda el cuerpo crudo (req.rawBody) → el webhook de Stripe verifica su firma HMAC sobre los bytes exactos
  });

  // [Trust proxy]: necesario para detectar IP real detrás de Nginx/CDN
  app.set('trust proxy', 1);

  // [Helmet]: seteo de headers de seguridad (CSP, HSTS, X-Frame-Options, etc.)
  app.use(helmet());

  // [Compresión gzip]: reduce payload en respuestas grandes
  app.use(compression());

  // [CORS]: solo orígenes whitelisted (separados por coma en env)
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:7000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // [Prefix global]: /api/v1/* | [Principio]: versionado explícito
  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // [Validation global]: rechaza props no declaradas + transforma a DTO classes
  app.useGlobalPipes(new ValidationPipe(GLOBAL_VALIDATION_OPTIONS));

  // [Swagger]: docs en /api/docs (no en prod si NODE_ENV=production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Plataforma Evaluación Cognitiva — API')
      .setDescription('Quiz + IA + RBAC')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // [Shutdown hooks]: cierra conexiones limpiamente al recibir SIGTERM/SIGINT
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT ?? '4000', 10);
  await app.listen(port);

  logger.log(`API listening on http://localhost:${port}/${apiPrefix}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger docs on http://localhost:${port}/${apiPrefix}/docs`);
  }
}

// [Top-level await wrap]: necesario porque main.ts no es ES module top-level
bootstrap().catch((err: unknown) => {
  // [Fallo en boot]: log + exit code 1 para que orquestador (PM2/k8s) reinicie

  console.error('Failed to bootstrap app', err);
  process.exit(1);
});
