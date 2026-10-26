import { join } from 'path';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AIModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { CoursesModule } from './modules/courses/courses.module';
import { CurriculumModule } from './modules/curriculum/curriculum.module';
import { AudioModule } from './modules/audio/audio.module'; // [Sprint 4.7]: audio de pronunciación con caché
import { FeedbackModule } from './modules/feedback/feedback.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { ScoreModule } from './modules/score/score.module';
import { UsersModule } from './modules/users/users.module';
import { ReportsModule } from './modules/reports/reports.module'; // [Sprint 6.4]: exportación PDF/Excel
import { PaymentsModule } from './modules/payments/payments.module'; // [Sprint 7.3]: órdenes, Stripe (modo prueba), webhooks y reembolsos
import { Web3Module } from './modules/web3/web3.module'; // [Sprints 7.5/7.6]: billetera SIWE, pago con ETH de prueba (Sepolia) y anclaje de hashes
import { CertificatesModule } from './modules/certificates/certificates.module'; // [Sprint 7.8]: certificado PDF con QR, hash anclado en Sepolia y verificación pública
import { HelpModule } from './modules/help/help.module'; // [Sprints 7.10/7.12]: FAQ, manual de usuario y proxy del Agente Guía
import { ForumsModule } from './modules/forums/forums.module'; // [Sprint 7.14]: foros por lección con moderación
import { GamesModule } from './modules/games/games.module'; // [Sprint 8.5]: juegos, mazo SM-2, fluidez y role-play
import { PracticeModule } from './modules/practice/practice.module'; // [Sprint 8.12]: práctica interactiva con retroalimentación
import { VocabularyModule } from './modules/vocabulary/vocabulary.module'; // [Sprint 8.2]: banco de vocabulario y caché de traducción e IPA
import { MusicModule } from './modules/music/music.module'; // [Sprint 9.2]: canciones con licencia, letra sincronizada, colecciones y prácticas
import { DialoguesModule } from './modules/dialogues/dialogues.module'; // [Sprint 9.3]: temas, diálogos guionados con nivel y conversación con el avatar
import { PolyglotModule } from './modules/polyglot/polyglot.module'; // [Sprints 10.5/10.6]: comparador de idiomas por tema con IPA y borrador con IA
import { GrammarModule } from './modules/grammar/grammar.module'; // [Sprints 10.9/10.10]: fichas de gramática con ejemplos, IPA UK/US y traducción
import { ReadingModule } from './modules/reading/reading.module'; // [2026-10-25 · Lectura]: textos por género con traducción, IPA, marcador y descarga
import { SchedulerModule } from './modules/scheduler/scheduler.module'; // [Sprint 7.18]: purga nocturna (cron de Bull) y panel de colas
import { RedisCacheModule } from './shared/cache/redis-cache.module'; // [Sprint 6.6]: caché distribuida
import databaseConfig from './shared/config/database.config';
import jwtConfig from './shared/config/jwt.config';
import redisConfig from './shared/config/redis.config';
import throttlerConfig from './shared/config/throttler.config';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { JwtAuthGuard } from './shared/guards/jwt-auth.guard';
import { RolesGuard } from './shared/guards/roles.guard';
import { CustomThrottlerGuard } from './shared/guards/throttler.guard';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './shared/interceptors/timeout.interceptor';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { validateStorageEnv } from './shared/config/storage.config';
import { validatePaymentsEnv } from './shared/config/payments.config';
import { validateWeb3Env } from './shared/config/web3.config';
// [App Module]: composición raíz del backend | [Patrón]: Module + DI Container | [Principio]: ISP + DIP | [Paradigma]: POO

@Module({
  imports: [
    // [ConfigModule global]: carga .env y registra namespaces
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, redisConfig, throttlerConfig],
      envFilePath: ['.env.local', '.env'],
      // [Fail Fast]: STORAGE_PROVIDER/S3_* (6.7), STRIPE_* (7.3) y WEB3_* (7.6) validadas con Zod antes de crear cualquier módulo | composición de funciones puras
      validate: (env) =>
        validateWeb3Env(validatePaymentsEnv(validateStorageEnv(env))),
    }),
    // [EventEmitter global]: bus interno para Domain Events | [Patrón]: Observer
    EventEmitterModule.forRoot({
      wildcard: true,
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
    // [TypeOrm async]: conexión PostgreSQL via factory | [Patrón]: Factory
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule.forFeature(databaseConfig)],
      inject: [databaseConfig.KEY],
      useFactory: (cfg: ConfigType<typeof databaseConfig>) => ({
        type: 'postgres',
        host: cfg.host,
        port: cfg.port,
        username: cfg.username,
        password: cfg.password,
        database: cfg.database,
        // [autoLoadEntities]: registra entities declaradas con TypeOrmModule.forFeature
        autoLoadEntities: true,
        synchronize: cfg.synchronize,
        // [Migraciones versionadas]: mismas que usa la CLI (src/database/data-source.ts) | glob `{.ts,.js}`: src con ts-node o dist compilado
        migrations: [join(__dirname, 'database', 'migrations', '*{.ts,.js}')],
        migrationsTableName: 'typeorm_migrations',
        migrationsRun: cfg.migrationsRun,
        logging: cfg.logging,
      }),
    }),
    // [Sprint 6.6 · Redis]: caché distribuida global (CACHE_MANAGER) y conexión de las colas Bull
    RedisCacheModule,
    BullModule.forRootAsync({
      imports: [ConfigModule.forFeature(redisConfig)],
      inject: [redisConfig.KEY],
      useFactory: (cfg: ConfigType<typeof redisConfig>) => ({
        redis: { host: cfg.host, port: cfg.port, password: cfg.password },
        prefix: 'aula:bull', // Separa las claves de las colas de las de la caché
      }),
    }),
    // [Throttler async]: límite global de requests | [Patrón]: Chain of Responsibility
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule.forFeature(throttlerConfig)],
      inject: [throttlerConfig.KEY],
      useFactory: (cfg: ConfigType<typeof throttlerConfig>) => [
        { ttl: cfg.ttl, limit: cfg.limit },
      ],
    }),
    // [Bounded Contexts]: cada feature en su propio módulo
    UsersModule,
    AuthModule,
    AIModule,
    QuizModule,
    ScoreModule,
    NotificationsModule,
    FeedbackModule,
    // [Catálogo de cursos de idiomas]: antes no estaba registrado → /courses respondía 404
    CoursesModule,
    // [Base de conocimiento curricular]: contenido manual, versionado y trazable (Fase 2)
    CurriculumModule,
    AudioModule,
    ReportsModule,
    PaymentsModule,
    Web3Module,
    CertificatesModule,
    HelpModule,
    ForumsModule,
    VocabularyModule,
    GamesModule,
    PracticeModule,
    MusicModule,
    DialoguesModule,
    PolyglotModule,
    GrammarModule,
    ReadingModule,
    SchedulerModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // [Global filter]: forma uniforme de errores | [Patrón]: Exception Filter
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    // [Global guards]: orden de ejecución asegurado por Nest (rate limit → JWT)
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // [RBAC]: hace cumplir @Roles(...) (antes no estaba registrado → los 45 @Roles no se aplicaban) | va DESPUÉS del JWT porque lee request.user
    { provide: APP_GUARD, useClass: RolesGuard },
    // [Global interceptors]: orden top-down: logging → timeout → transform
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
  ],
})
export class AppModule {}
