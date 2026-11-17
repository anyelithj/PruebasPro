import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { GLOBAL_VALIDATION_OPTIONS } from './shared/pipes/validation.pipe';
import { setupSwagger, SWAGGER_PATH } from './shared/config/swagger.config';
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

  // [Body parser · 2026-10-25]: `useBodyParser` (NestJS · Express) sube el límite JSON de 100 KB (por defecto) a 2 MB → el contenido Markdown de un curso (columna `text`, sin MaxLength) se puede guardar | conserva `rawBody: true` (webhook de Stripe) | [Principio]: límite explícito (mitiga DoS por cuerpos enormes)
  app.useBodyParser('json', { limit: '8mb' }); // [2026-11-03]: 2 → 8 MB = bodySizeLimit de Next (juegos con imágenes por palabra)

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

  // [Swagger · Sprint 11.2]: UI en /api/v1/docs y OpenAPI 3 en /api/v1/docs-json (no en prod) | [Principio]: DRY (config única en shared/config/swagger.config.ts)
  setupSwagger(app, apiPrefix);

  // [Shutdown hooks]: cierra conexiones limpiamente al recibir SIGTERM/SIGINT
  app.enableShutdownHooks();

  const port = parseInt(process.env.PORT ?? '4000', 10);
  await app.listen(port);
  // [2026-10-24 · Keep-alive]: el BFF de Next (undici) reutiliza sockets; con el valor por defecto de Node (5 s) NestJS cerraba el socket ocioso justo cuando Next lo reutilizaba → `ECONNRESET` | [Patrón]: Server timeout > client timeout | [Principio]: Fail Safe
  // `getHttpServer()` (NestJS): `http.Server` de Node; `headersTimeout` debe ser mayor que `keepAliveTimeout` (regla de Node)
  const httpServer = app.getHttpServer() as import('http').Server; // `import('http').Server` (TS): tipo inline sin import adicional
  httpServer.keepAliveTimeout = 65_000;
  httpServer.headersTimeout = 66_000;

  logger.log(`API listening on http://localhost:${port}/${apiPrefix}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.log(`Swagger docs on http://localhost:${port}/${apiPrefix}/${SWAGGER_PATH}`);
  }
}

// [2026-11-07]: una promesa rechazada sin catch (p. ej. `ECONNREFUSED 127.0.0.1:<puerto efímero>` de una extensión inyectada como Console Ninja) tumbaba la API entera → se registra y el servidor sigue
process.on('unhandledRejection', (reason) => new Logger('Process').error(`Promesa rechazada sin manejar: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`));

// [Top-level await wrap]: necesario porque main.ts no es ES module top-level
bootstrap().catch((err: unknown) => {
  // [Fallo en boot]: log + exit code 1 para que orquestador (PM2/k8s) reinicie

  console.error('Failed to bootstrap app', err);
  process.exit(1);
});
